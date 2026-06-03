// import mongoose from 'mongoose';
// import asyncHandler from '../utils/asyncHandler.js';
// import LoadingPlan from '../models/loadingPlanModel.js';
// import Container from '../models/containerModel.js';
// import Pallet from '../models/palletModel.js';
// import { generateId } from '../services/idGenerator.js';

// const deepPopulate = [
//     {
//         path: 'factory',
//         select: 'name'
//     },
//     {
//         path: 'createdBy',
//         select: 'username'
//     },
//     {
//         path: 'containers',
//         populate: [
//             {
//                 path: 'pallets',
//                 model: 'Pallet',
//                 populate: [
//                     { path: 'tile', model: 'Tile', select: 'name size surface' },
//                     { path: 'factory', model: 'Factory', select: 'name' }
//                 ]
//             },
//             {
//                 path: 'khatlis',
//                 model: 'Pallet',
//                 populate: [
//                     { path: 'tile', model: 'Tile', select: 'name size surface' },
//                     { path: 'factory', model: 'Factory', select: 'name' }
//                 ]
//             }
//         ]
//     }
// ];

// /**
//  * @desc    Create a new Loading Plan
//  * @route   POST /api/loading-plans
//  * @access  Private
//  * UPDATED: Supports pallets from multiple factories and properly separates pallets/khatlis
//  */
// export const createLoadingPlan = asyncHandler(async (req, res) => {
//     const { factoryId, containers } = req.body;
//     const userId = req.user._id;

//     if (!factoryId || !containers || containers.length === 0) {
//         res.status(400);
//         throw new Error('Factory and containers are required');
//     }

//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         const loadingPlanId = await generateId('LP');
//         const createdContainers = [];

//         for (const containerData of containers) {
//             const { containerNumber, truckNumber, pallets } = containerData;

//             if (!containerNumber || !truckNumber) {
//                 throw new Error('Container number and truck number are required');
//             }

//             if (!pallets || pallets.length === 0) {
//                 throw new Error(`Container ${containerNumber} has no pallets`);
//             }

//             // Fetch all pallets/khatlis by ID - NOTE: Allow from ANY factory (multi-factory support)
//             const palletDocs = await Pallet.find({
//                 _id: { $in: pallets },
//                 status: 'InFactoryStock',
//                 // Removed factory filter to allow multi-factory selection
//             }).session(session);

//             if (palletDocs.length !== pallets.length) {
//                 // Find which pallets are missing or unavailable
//                 const foundIds = new Set(palletDocs.map(p => p._id.toString()));
//                 const missingIds = pallets.filter(id => !foundIds.has(id));
//                 throw new Error(`Some pallets are not available or already loaded. Missing: ${missingIds.length} items`);
//             }

//             // Separate by type
//             const palletIds = [];
//             const khatliIds = [];

//             palletDocs.forEach((pallet) => {
//                 if (pallet.type === 'Pallet') {
//                     palletIds.push(pallet._id);
//                 } else if (pallet.type === 'Khatli') {
//                     khatliIds.push(pallet._id);
//                 }
//             });

//             // Generate container ID
//             const containerId = await generateId('CN');

//             // Create container with all required fields
//             const container = new Container({
//                 containerId: containerId,
//                 containerNumber: containerNumber,
//                 truckNumber: truckNumber,
//                 factory: factoryId, // Main factory for the loading plan
//                 pallets: palletIds,
//                 khatlis: khatliIds,
//                 status: 'Loaded',
//                 createdBy: userId, // Required field
//             });

//             await container.save({ session });
//             createdContainers.push(container._id);

//             // Update pallet statuses
//             await Pallet.updateMany(
//                 { _id: { $in: pallets } },
//                 {
//                     $set: {
//                         status: 'LoadedInContainer',
//                         container: container._id,
//                         loadedAt: new Date(),
//                     },
//                 },
//                 { session }
//             );
//         }

//         // Create loading plan
//         const loadingPlan = new LoadingPlan({
//             loadingPlanId,
//             factory: factoryId,
//             containers: createdContainers,
//             status: 'Finalized',
//             createdBy: userId,
//         });

//         await loadingPlan.save({ session });
//         await session.commitTransaction();

//         // Fetch the complete loading plan with populated data
//         const populatedPlan = await LoadingPlan.findById(loadingPlan._id).populate(deepPopulate);

//         res.status(201).json({
//             message: 'Loading plan created successfully',
//             loadingPlan: populatedPlan,
//         });
//     } catch (error) {
//         await session.abortTransaction();
//         res.status(400);
//         throw new Error(error.message);
//     } finally {
//         session.endSession();
//     }
// });


// export const getLoadingPlans = asyncHandler(async (req, res) => {
//     const plans = await LoadingPlan.find({}).populate(deepPopulate).sort({ createdAt: -1 });
//     res.status(200).json(plans);
// });


// export const getLoadingPlanById = asyncHandler(async (req, res) => {
//     const plan = await LoadingPlan.findById(req.params.id)
//         .populate('factory', 'name address')
//         .populate({
//             path: 'containers',
//             populate: [
//                 {
//                     path: 'pallets',
//                     populate: [
//                         { path: 'tile', select: 'name size surface' },
//                         { path: 'factory', select: 'name' }
//                     ]
//                 },
//                 {
//                     path: 'khatlis',
//                     populate: [
//                         { path: 'tile', select: 'name size surface' },
//                         { path: 'factory', select: 'name' }
//                     ]
//                 },
//             ],
//         })
//         .populate('createdBy', 'username');

//     if (!plan) {
//         res.status(404);
//         throw new Error('Loading plan not found');
//     }

//     res.status(200).json(plan);
// });


// /**
//  * @desc    Update Loading Plan status
//  * @route   PUT /api/loading-plans/:id/status
//  * @access  Private
//  */
// export const updateLoadingPlanStatus = asyncHandler(async (req, res) => {
//     const { id } = req.params;
//     const { status } = req.body;

//     const validStatuses = ['Finalized', 'Dispatched'];
//     if (!validStatuses.includes(status)) {
//         res.status(400);
//         throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
//     }

//     const plan = await LoadingPlan.findByIdAndUpdate(
//         id,
//         { status },
//         { new: true, runValidators: true }
//     );

//     if (!plan) {
//         res.status(404);
//         throw new Error('Loading Plan not found');
//     }

//     res.status(200).json({
//         message: 'Loading Plan status updated successfully',
//         plan
//     });
// });


// /**
//  * @desc    Get Loading Plans by Factory
//  * @route   GET /api/loading-plans/factory/:factoryId
//  * @access  Private
//  */
// export const getLoadingPlansByFactory = asyncHandler(async (req, res) => {
//     const { factoryId } = req.params;

//     const plans = await LoadingPlan.find({ factory: factoryId })
//         .populate('factory', 'name')
//         .populate('createdBy', 'name')
//         .populate({
//             path: 'containers',
//             populate: [
//                 {
//                     path: 'pallets',
//                     select: 'palletId tile status boxCount type',
//                     populate: { path: 'tile', select: 'name size' }
//                 },
//                 {
//                     path: 'khatlis',
//                     select: 'palletId tile status boxCount type',
//                     populate: { path: 'tile', select: 'name size' }
//                 }
//             ]
//         })
//         .sort({ createdAt: -1 });

//     res.status(200).json(plans);
// });

// /**
//  * @desc    Update an existing Loading Plan
//  * @route   PUT /api/loading-plans/:id
//  * @access  Private
//  * UPDATED: Supports pallets/khatlis separation and multi-factory
//  */
// export const updateLoadingPlan = asyncHandler(async (req, res) => {
//     const { id } = req.params;
//     const { containers: updatedContainersData, loadingDate } = req.body;
//     const userId = req.user._id;

//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         const plan = await LoadingPlan.findById(id)
//             .populate({
//                 path: 'containers',
//                 populate: ['pallets', 'khatlis']
//             })
//             .session(session);

//         if (!plan) {
//             throw new Error('Loading Plan not found');
//         }

//         // --- 1. Update simple fields ---
//         plan.loadingDate = loadingDate || plan.loadingDate;

//         // --- 2. Get all original pallet/khatli IDs ---
//         const originalPalletIds = new Set();
//         plan.containers.forEach(c => {
//             (c.pallets || []).forEach(p => originalPalletIds.add(p._id.toString()));
//             (c.khatlis || []).forEach(k => originalPalletIds.add(k._id.toString()));
//         });

//         // --- 3. Get all final pallet IDs from updated data ---
//         const finalPalletIds = new Set();
//         updatedContainersData.forEach(c => {
//             (c.pallets || []).forEach(id => finalPalletIds.add(id));
//         });

//         // --- 4. Determine which to revert and which to assign ---
//         const palletsToRevert = [...originalPalletIds].filter(pId => !finalPalletIds.has(pId));
//         const palletsToAssign = [...finalPalletIds].filter(pId => !originalPalletIds.has(pId));

//         // --- 5. Revert removed pallets back to factory stock ---
//         if (palletsToRevert.length > 0) {
//             await Pallet.updateMany(
//                 { _id: { $in: palletsToRevert } },
//                 { $set: { status: 'InFactoryStock', container: null, loadedAt: null } },
//                 { session }
//             );
//         }

//         // --- 6. Process each container ---
//         for (const updatedContainer of updatedContainersData) {
//             // Fetch pallet docs to separate by type
//             const palletDocs = await Pallet.find({
//                 _id: { $in: updatedContainer.pallets || [] }
//             }).session(session);

//             const palletIds = [];
//             const khatliIds = [];

//             palletDocs.forEach((pallet) => {
//                 if (pallet.type === 'Pallet') {
//                     palletIds.push(pallet._id);
//                 } else if (pallet.type === 'Khatli') {
//                     khatliIds.push(pallet._id);
//                 }
//             });

//             await Container.updateOne(
//                 { _id: updatedContainer._id },
//                 {
//                     $set: {
//                         containerNumber: updatedContainer.containerNumber,
//                         truckNumber: updatedContainer.truckNumber,
//                         pallets: palletIds,
//                         khatlis: khatliIds,
//                     }
//                 },
//                 { session }
//             );

//             // Update status for all pallets in this container
//             if (updatedContainer.pallets && updatedContainer.pallets.length > 0) {
//                 await Pallet.updateMany(
//                     { _id: { $in: updatedContainer.pallets } },
//                     { $set: { status: 'LoadedInContainer', container: updatedContainer._id } },
//                     { session }
//                 );
//             }
//         }

//         await plan.save({ session });
//         await session.commitTransaction();

//         const finalPlan = await LoadingPlan.findById(id).populate(deepPopulate);
//         res.status(200).json(finalPlan);

//     } catch (error) {
//         await session.abortTransaction();
//         res.status(400).json({ message: error.message || 'Failed to update loading plan.' });
//     } finally {
//         session.endSession();
//     }
// });

// /**
//  * @desc    Delete a Loading Plan
//  * @route   DELETE /api/loading-plans/:id
//  * @access  Private
//  */
// export const deleteLoadingPlan = asyncHandler(async (req, res) => {
//     const { id } = req.params;
//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         const plan = await LoadingPlan.findById(id)
//             .populate({
//                 path: 'containers',
//                 populate: ['pallets', 'khatlis']
//             })
//             .session(session);

//         if (!plan) {
//             throw new Error('Loading Plan not found');
//         }

//         // Collect all pallet and khatli IDs to revert
//         const palletIdsToRevert = [];
//         plan.containers.forEach(c => {
//             (c.pallets || []).forEach(p => palletIdsToRevert.push(p._id));
//             (c.khatlis || []).forEach(k => palletIdsToRevert.push(k._id));
//         });

//         // Revert all pallets/khatlis back to factory stock
//         if (palletIdsToRevert.length > 0) {
//             await Pallet.updateMany(
//                 { _id: { $in: palletIdsToRevert } },
//                 { $set: { status: 'InFactoryStock', container: null, loadedAt: null } },
//                 { session }
//             );
//         }

//         // Delete all containers
//         await Container.deleteMany(
//             { _id: { $in: plan.containers.map(c => c._id) } },
//             { session }
//         );

//         // Delete the loading plan
//         await LoadingPlan.findByIdAndDelete(id, { session });

//         await session.commitTransaction();
//         res.status(200).json({ message: 'Loading Plan deleted successfully.' });

//     } catch (error) {
//         await session.abortTransaction();
//         res.status(400).json({ message: error.message });
//     } finally {
//         session.endSession();
//     }
// });

import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import LoadingPlan from '../models/loadingPlanModel.js';
import Container from '../models/containerModel.js';
import Pallet from '../models/palletModel.js';
import { generateId } from '../services/idGenerator.js';

const deepPopulate = [
    {
        path: 'factory',
        select: 'name'
    },
    {
        path: 'createdBy',
        select: 'username'
    },
    {
        path: 'containers',
        populate: [
            {
                path: 'pallets',
                model: 'Pallet',
                populate: [
                    { path: 'tile', model: 'Tile', select: 'name size surface' },
                    { path: 'factory', model: 'Factory', select: 'name' }
                ]
            },
            {
                path: 'khatlis',
                model: 'Pallet',
                populate: [
                    { path: 'tile', model: 'Tile', select: 'name size surface' },
                    { path: 'factory', model: 'Factory', select: 'name' }
                ]
            }
        ]
    }
];

/**
 * @desc    Create a new Loading Plan
 * @route   POST /api/loading-plans
 * @access  Private
 * UPDATED: Supports pallets from multiple factories and properly separates pallets/khatlis
 */
export const createLoadingPlan = asyncHandler(async (req, res) => {
    const { factoryId, containers } = req.body;
    const userId = req.user._id;

    if (!factoryId || !containers || containers.length === 0) {
        res.status(400);
        throw new Error('Factory and containers are required');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const loadingPlanId = await generateId('LP');
        const createdContainers = [];

        for (const containerData of containers) {
            const { containerNumber, truckNumber, pallets } = containerData;

            if (!containerNumber || !truckNumber) {
                throw new Error('Container number and truck number are required');
            }

            if (!pallets || pallets.length === 0) {
                throw new Error(`Container ${containerNumber} has no pallets`);
            }

            // Fetch all pallets/khatlis by ID - NOTE: Allow from ANY factory (multi-factory support)
            const palletDocs = await Pallet.find({
                _id: { $in: pallets },
                status: 'InFactoryStock',
                // Removed factory filter to allow multi-factory selection
            }).session(session);

            if (palletDocs.length !== pallets.length) {
                // Find which pallets are missing or unavailable
                const foundIds = new Set(palletDocs.map(p => p._id.toString()));
                const missingIds = pallets.filter(id => !foundIds.has(id));
                throw new Error(`Some pallets are not available or already loaded. Missing: ${missingIds.length} items`);
            }

            // Separate by type
            const palletIds = [];
            const khatliIds = [];

            palletDocs.forEach((pallet) => {
                if (pallet.type === 'Pallet') {
                    palletIds.push(pallet._id);
                } else if (pallet.type === 'Khatli') {
                    khatliIds.push(pallet._id);
                }
            });

            // Generate container ID
            const containerId = await generateId('CN');

            // Create container with all required fields
            const container = new Container({
                containerId: containerId,
                containerNumber: containerNumber,
                truckNumber: truckNumber,
                factory: factoryId, // Main factory for the loading plan
                pallets: palletIds,
                khatlis: khatliIds,
                status: 'Loaded',
                createdBy: userId, // Required field
            });

            await container.save({ session });
            createdContainers.push(container._id);

            // Update pallet statuses
            await Pallet.updateMany(
                { _id: { $in: pallets } },
                {
                    $set: {
                        status: 'LoadedInContainer',
                        container: container._id,
                        loadedAt: new Date(),
                    },
                },
                { session }
            );
        }

        // Create loading plan
        const loadingPlan = new LoadingPlan({
            loadingPlanId,
            factory: factoryId,
            containers: createdContainers,
            status: 'Finalized',
            createdBy: userId,
        });

        await loadingPlan.save({ session });

        // Link containers back to this loading plan
        await Container.updateMany(
            { _id: { $in: createdContainers } },
            { $set: { loadingPlan: loadingPlan._id } },
            { session }
        );

        await session.commitTransaction();

        // Fetch the complete loading plan with populated data
        const populatedPlan = await LoadingPlan.findById(loadingPlan._id).populate(deepPopulate);

        res.status(201).json({
            message: 'Loading plan created successfully',
            loadingPlan: populatedPlan,
        });
    } catch (error) {
        await session.abortTransaction();
        res.status(400);
        throw new Error(error.message);
    } finally {
        session.endSession();
    }
});


export const getLoadingPlans = asyncHandler(async (req, res) => {
    const plans = await LoadingPlan.find({}).populate(deepPopulate).sort({ createdAt: -1 });
    res.status(200).json(plans);
});


export const getLoadingPlanById = asyncHandler(async (req, res) => {
    const plan = await LoadingPlan.findById(req.params.id)
        .populate('factory', 'name address')
        .populate({
            path: 'containers',
            populate: [
                {
                    path: 'pallets',
                    populate: [
                        { path: 'tile', select: 'name size surface' },
                        { path: 'factory', select: 'name' }
                    ]
                },
                {
                    path: 'khatlis',
                    populate: [
                        { path: 'tile', select: 'name size surface' },
                        { path: 'factory', select: 'name' }
                    ]
                },
            ],
        })
        .populate('createdBy', 'username');

    if (!plan) {
        res.status(404);
        throw new Error('Loading plan not found');
    }

    res.status(200).json(plan);
});


/**
 * @desc    Update Loading Plan status
 * @route   PUT /api/loading-plans/:id/status
 * @access  Private
 */
export const updateLoadingPlanStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Finalized', 'Dispatched'];
    if (!validStatuses.includes(status)) {
        res.status(400);
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const plan = await LoadingPlan.findByIdAndUpdate(
        id,
        { status },
        { new: true, runValidators: true }
    );

    if (!plan) {
        res.status(404);
        throw new Error('Loading Plan not found');
    }

    res.status(200).json({
        message: 'Loading Plan status updated successfully',
        plan
    });
});


/**
 * @desc    Get Loading Plans by Factory
 * @route   GET /api/loading-plans/factory/:factoryId
 * @access  Private
 */
export const getLoadingPlansByFactory = asyncHandler(async (req, res) => {
    const { factoryId } = req.params;

    const plans = await LoadingPlan.find({ factory: factoryId })
        .populate('factory', 'name')
        .populate('createdBy', 'name')
        .populate({
            path: 'containers',
            populate: [
                {
                    path: 'pallets',
                    select: 'palletId tile status boxCount type',
                    populate: { path: 'tile', select: 'name size' }
                },
                {
                    path: 'khatlis',
                    select: 'palletId tile status boxCount type',
                    populate: { path: 'tile', select: 'name size' }
                }
            ]
        })
        .sort({ createdAt: -1 });

    res.status(200).json(plans);
});

/**
 * @desc    Update an existing Loading Plan
 * @route   PUT /api/loading-plans/:id
 * @access  Private
 * UPDATED: Supports pallets/khatlis separation and multi-factory
 */
export const updateLoadingPlan = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { containers: updatedContainersData, loadingDate } = req.body;
    const userId = req.user._id;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const plan = await LoadingPlan.findById(id)
            .populate({
                path: 'containers',
                populate: ['pallets', 'khatlis']
            })
            .session(session);

        if (!plan) {
            throw new Error('Loading Plan not found');
        }

        // --- 1. Update simple fields ---
        plan.loadingDate = loadingDate || plan.loadingDate;

        // --- 2. Get all original pallet/khatli IDs ---
        const originalPalletIds = new Set();
        plan.containers.forEach(c => {
            (c.pallets || []).forEach(p => originalPalletIds.add(p._id.toString()));
            (c.khatlis || []).forEach(k => originalPalletIds.add(k._id.toString()));
        });

        // --- 3. Get all final pallet IDs from updated data ---
        const finalPalletIds = new Set();
        updatedContainersData.forEach(c => {
            (c.pallets || []).forEach(id => finalPalletIds.add(id));
        });

        // --- 4. Determine which to revert and which to assign ---
        const palletsToRevert = [...originalPalletIds].filter(pId => !finalPalletIds.has(pId));
        const palletsToAssign = [...finalPalletIds].filter(pId => !originalPalletIds.has(pId));

        // --- 5. Revert removed pallets back to factory stock ---
        if (palletsToRevert.length > 0) {
            await Pallet.updateMany(
                { _id: { $in: palletsToRevert } },
                { $set: { status: 'InFactoryStock', container: null, loadedAt: null } },
                { session }
            );
        }

        // --- 6. Process each container ---
        for (const updatedContainer of updatedContainersData) {
            // Fetch pallet docs to separate by type
            const palletDocs = await Pallet.find({
                _id: { $in: updatedContainer.pallets || [] }
            }).session(session);

            const palletIds = [];
            const khatliIds = [];

            palletDocs.forEach((pallet) => {
                if (pallet.type === 'Pallet') {
                    palletIds.push(pallet._id);
                } else if (pallet.type === 'Khatli') {
                    khatliIds.push(pallet._id);
                }
            });

            await Container.updateOne(
                { _id: updatedContainer._id },
                {
                    $set: {
                        containerNumber: updatedContainer.containerNumber,
                        truckNumber: updatedContainer.truckNumber,
                        pallets: palletIds,
                        khatlis: khatliIds,
                    }
                },
                { session }
            );

            // Update status for all pallets in this container
            if (updatedContainer.pallets && updatedContainer.pallets.length > 0) {
                await Pallet.updateMany(
                    { _id: { $in: updatedContainer.pallets } },
                    { $set: { status: 'LoadedInContainer', container: updatedContainer._id } },
                    { session }
                );
            }
        }

        await plan.save({ session });
        await session.commitTransaction();

        const finalPlan = await LoadingPlan.findById(id).populate(deepPopulate);
        res.status(200).json(finalPlan);

    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ message: error.message || 'Failed to update loading plan.' });
    } finally {
        session.endSession();
    }
});

/**
 * @desc    Delete a Loading Plan
 * @route   DELETE /api/loading-plans/:id
 * @access  Private
 */
export const deleteLoadingPlan = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const plan = await LoadingPlan.findById(id)
            .populate({
                path: 'containers',
                populate: ['pallets', 'khatlis']
            })
            .session(session);

        if (!plan) {
            throw new Error('Loading Plan not found');
        }

        // Collect all pallet and khatli IDs to revert
        const palletIdsToRevert = [];
        plan.containers.forEach(c => {
            (c.pallets || []).forEach(p => palletIdsToRevert.push(p._id));
            (c.khatlis || []).forEach(k => palletIdsToRevert.push(k._id));
        });

        // Revert all pallets/khatlis back to factory stock
        if (palletIdsToRevert.length > 0) {
            await Pallet.updateMany(
                { _id: { $in: palletIdsToRevert } },
                { $set: { status: 'InFactoryStock', container: null, loadedAt: null } },
                { session }
            );
        }

        // Delete all containers
        await Container.deleteMany(
            { _id: { $in: plan.containers.map(c => c._id) } },
            { session }
        );

        // Delete the loading plan
        await LoadingPlan.findByIdAndDelete(id, { session });

        await session.commitTransaction();
        res.status(200).json({ message: 'Loading Plan deleted successfully.' });

    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ message: error.message });
    } finally {
        session.endSession();
    }
});