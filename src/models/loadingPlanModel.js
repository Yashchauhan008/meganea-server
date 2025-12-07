import mongoose from 'mongoose';

const loadingPlanSchema = new mongoose.Schema(
    {
        loadingPlanId: {
            type: String,
            required: true,
            unique: true,
            sparse: true,
        },
        factory: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Factory',
            required: true,
        },
        containers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Container',
        }],
        status: {
            type: String,
            enum: ['Finalized', 'Dispatched'], // Added Dispatched for future use
            default: 'Finalized',
        },
        // --- NEW FIELD ADDED ---
        loadingDate: {
            type: Date,
            default: Date.now, // Defaults to the creation date
        },
        // -----------------------
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    { timestamps: true }
);

const LoadingPlan = mongoose.model('LoadingPlan', loadingPlanSchema);
export default LoadingPlan;
