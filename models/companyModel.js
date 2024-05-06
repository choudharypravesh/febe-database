//user model
module.exports = (sequelize, DataTypes) => {
    const Company = sequelize.define( "company", {
        company_name: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false
        },
    }, {timestamps: true}, )
    return Company
}