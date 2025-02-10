require('dotenv').config();
const axios = require('axios')
const WebSocket = require('ws');
const { SOUL_API_BASE_URL, GITHUB_ACCESS_TOKEN } = process.env;

const publish = async (req, res) => {
    try {
        const graphId = req.body.graph_id;
        const schemaByGraphId = await axios.get(`${SOUL_API_BASE_URL}/tables/graphs/rows/${graphId}`);
        const schemaData = schemaByGraphId?.data?.data;
        const transformedData = transformSchemaData(schemaData, graphId);
        console.log("🚀 ~ transformedData ~ ex:", transformedData)
        const engineResponse = await startEngineForBuildAndDeploy(transformedData);

        return res.status(200).send({
            statusCode: 204,
            success: 'ok',
            message: 'Data sent to backend successfully',
            data: transformedData
        })
    } catch (ex) {
        return res.status(500).send({
            statusCode: 500,
            failed: 'ok',
            message: 'Error starting the engine : ' + JSON.stringify(ex),
            data: {}
        })
    }
}

const transformSchemaData = (data, graphId) => {
    try {
        const schema = data[0]

        const result = {
            projectName: schema.name,
            enviromentID:"1234",
            organizationID:"1234",
            subOrganizationID:"1234",
            graphID:graphId,
            tables: []
        };

        const tableDict = JSON.parse(schema.tableDict);
        const linkDict = JSON.parse(schema.linkDict);

        // Helper function to get table name by id
        const getTableNameById = (id) => {
            for (const tableKey in tableDict) {
                if (tableDict[tableKey].id === id) {
                    return tableDict[tableKey].name;
                }
            }
            return null;
        };

        // Create a map to hold table relations
        const tableRelations = {};

        // Iterate over linkDict to find relations
        for (const linkKey in linkDict) {
            const link = linkDict[linkKey];
            const [endpoint1, endpoint2] = link.endpoints;

            // Assume endpoint1 is the primary key side (one side) and endpoint2 is the foreign key side (many side)
            const tableId1 = endpoint1.id;
            const tableId2 = endpoint2.id;

            const relatedTableName1 = getTableNameById(tableId1);
            const relatedTableName2 = getTableNameById(tableId2);

            if (!tableRelations[tableId1]) {
                tableRelations[tableId1] = new Set();
            }
            tableRelations[tableId1].add(relatedTableName2);
        }

        // Iterate over tableDict to structure the tables
        for (const tableKey in tableDict) {
            const table = tableDict[tableKey];
            const tableName = table.name;
            const fields = table.fields.map(field => ({
                name: field.name,
                type: field.type
            }));

            const relations = [];
            if (tableRelations[table.id]) {
                tableRelations[table.id].forEach(relatedTableName => {
                    relations.push({ table: [{ name: relatedTableName }] });
                });
            }

            const tableEntry = {
                [tableName]: {
                    fields,
                    relations
                }
            };

            result.tables.push(tableEntry);
        }

        return result;
    } catch (ex) {
        console.log("🚀 ~ transformSchemaData ~ ex:", ex);
        return {}
    }
}

const startEngineForBuildAndDeploy = async (schema) => {
    try {
        const body = {
            event_type: "custom_event",
            client_payload: {
                success: "ok",
                message: "Data sent to backend successfully",
                data: schema
            }
         }

         const res = await axios.post('https://api.github.com/repos/ravi-dhyani8881/local/dispatches', body, {
            headers: {
                Authorization: GITHUB_ACCESS_TOKEN,
                Accept: 'application/json'
            }
         });
         return res;
    } catch (ex) {
        console.log("🚀 ~ startEngineForBuildAndDeploy ~ ex:", ex)
        return ex
    }

}

const publishCallback = async (req, res) => {
    console.log("[HTTP] Received GitHub callback:", req.body);  
    const socketServer = req.app.locals.socketServer; // Access WebSocket server

  if (!socketServer) {
    return res.status(500).json({ error: "WebSocket server is not available" });
  }

  // Extract relevant data from GitHub request (modify as needed)
  const message = {
    event: "publish_complete",
    graphId: req.body.graphId || "unknown",
    status: req.body.status || "success",
    timestamp: new Date().toISOString(),
  };

  // Send the update to all connected WebSocket clients
  socketServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });

  res.status(200).json({ success: true, message: "Update sent to WebSocket clients." });
}


module.exports = {
    publish,
    publishCallback
}