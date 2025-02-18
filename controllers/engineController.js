require('dotenv').config();
const axios = require('axios')
const WebSocket = require('ws');
const { SOUL_API_BASE_URL, GITHUB_ACCESS_TOKEN } = process.env;

const publish = async (req, res) => {
    try {
        const graphId = req.body.graph_id;
        const schemaByGraphId = await axios.get(`${SOUL_API_BASE_URL}/tables/graphs/rows/${graphId}`);
        const schemaData = schemaByGraphId?.data?.data;
        const transformedData = transformSchema(schemaData, graphId);
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

function transformSchema(data, graph_id) {
    try {
        const schema = data[0];
        if (!schema || typeof schema !== 'object') {
            throw new Error("Invalid schema provided");
        }

        const result = {
            projectName: schema.name || "Unknown Project",
            enviromentID:"1234",
            organizationID:"1234",
            subOrganizationID:"1234",
            graphID:graph_id,
            schema: JSON.stringify(schema),
            tables: []
        };

        let tableDict, linkDict;
        try {
            tableDict = JSON.parse(schema.tableDict);
            linkDict = JSON.parse(schema.linkDict);
        } catch (error) {
            throw new Error("Error parsing tableDict or linkDict: " + error.message);
        }

        if (!tableDict || !linkDict) {
            throw new Error("tableDict or linkDict is missing or invalid");
        }

        // Helper functions
        const getFieldNameById = (tableId, fieldId) => {
            const table = tableDict[tableId];
            return table?.fields?.find(f => f.id === fieldId)?.name;
        };

        const getTableNameById = (id) => tableDict[id]?.name;

        const tableRelations = {};

        // Relationship grouping logic
        const upsertRelationship = (sourceTableId, targetTableName, mapping) => {
            if (!tableRelations[sourceTableId]) tableRelations[sourceTableId] = [];
            
            const existing = tableRelations[sourceTableId].find(
                rel => rel.table === targetTableName
            );
            
            if (existing) {
                existing.mappings.push(mapping);
            } else {
                tableRelations[sourceTableId].push({
                    table: targetTableName,
                    mappings: [mapping]
                });
            }
        };

        // Process links
        for (const link of Object.values(linkDict)) {
            try {
                if (!link.endpoints?.length === 2) continue;
                
                const [ep1, ep2] = link.endpoints;
                const t1 = ep1.id, t2 = ep2.id;
                const f1 = getFieldNameById(t1, ep1.fieldId);
                const f2 = getFieldNameById(t2, ep2.fieldId);
                const tn1 = getTableNameById(t1);
                const tn2 = getTableNameById(t2);

                if (!tn1 || !tn2 || !f1 || !f2) continue;

                // Create bidirectional mappings
                const mapping1 = { [`${tn1}.${f1}`]: `${tn2}.${f2}` };
                const mapping2 = { [`${tn2}.${f2}`]: `${tn1}.${f1}` };

                upsertRelationship(t1, tn2, mapping1);
                upsertRelationship(t2, tn1, mapping2);
            } catch (error) {
                console.error("Error processing link:", error);
            }
        }

        // Build final tables
        for (const table of Object.values(tableDict)) {
            try {
                if (!table.name || !table.fields) continue;
                
                result.tables.push({
                    [table.name]: {
                        fields: table.fields.map(({ name, type }) => ({ name, type })),
                        relations: tableRelations[table.id] || []
                    }
                });
            } catch (error) {
                console.error("Error processing table:", error);
            }
        }

        return result
    } catch (error) {
        console.error("Transform error:", error);
        return null;
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