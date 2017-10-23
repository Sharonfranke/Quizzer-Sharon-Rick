var quizSchema = new Schema({
    _id: {
        type: Schema.Types.ObjectId,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true
    },
    teams: [{
        type: Schema.Types.ObjectId,
        ref: 'teams'
    }],
    rounds: [{
        type: Schema.Types.ObjectId,
        ref: 'rounds'
    }]
});