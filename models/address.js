const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AddressSchema = new Schema({
    city: String,
    country: String,
    voivodeship: String,
    longitude: String,
    latitude: String
})

module.exports = AddressSchema;