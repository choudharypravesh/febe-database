//user model
module.exports = (sequelize, DataTypes) => {
    const UserGroups = sequelize.define( "usergroups", {
        group_name: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false
        },
        company_id: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false
        }
    }, {timestamps: true}, )
    return UserGroups
}