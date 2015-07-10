module.exports = function(mongoose) {
    return mongoose.model('Image', new mongoose.Schema({
        name: { type: String, required: true, unique: true },
        type: { type: String, required: true },
        base64: { type: String, required: true },
        loaded: { type: Number, required: true, default: 0 },
        date: { type: Date, default: Date.now },
        viewers: [{ userid: String, email: String }]
    }));
}
