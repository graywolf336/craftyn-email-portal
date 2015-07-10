module.exports = function(mongoose) {
    return mongoose.model('User', new mongoose.Schema({
        user_id: { type: Number, required: true, unique: true, index: true },
        email: { type: String, required: true, index: true },
        username: { type: String, required: true, unique: true, index: true },
        minecraft: { type: String, required: true, index: true },
        dates: {
            active: Date,
            register: Date
        },
        states: {
            banned: { type: Boolean, required: true },
            user: { type: String, required: true },
            visible: { type: Boolean, required: true },
            activity_visible: { type: Boolean, required: true }
        },
        unsubscribed: { type: Boolean, required: true, index: true },
        emails: [{ email: String, subject: String, id: String, viewed: Boolean, web: Boolean }]
    }, { autoIndex: false }));
}
