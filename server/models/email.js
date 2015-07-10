module.exports = function(mongoose) {
    return mongoose.model('Email', new mongoose.Schema({
        body: {
            html: { type: String, required: true },
            text: { type: String, required: true }
        },
        files: {
            attached: [{
                filename: { type: String, required: true },
                filetype: { type: String, required: true },
                filesize: { type: Number, required: true },
                base64: { type: String, required: true }
            }],
            images: [{
                filename: { type: String, required: true },
                filetype: { type: String, required: true },
                filesize: { type: Number, required: true },
                base64: { type: String, required: true }
            }]
        },
        subject: { type: String, required: true },
        status: { type: String, required: true },
        date: { type: Date, default: Date.now }
    }));
}
