import mongoose, { mongo } from 'mongoose';
import Product from '../mongodb/models/product.js';
import User from '../mongodb/models/user.js';

import * as dotenv from 'dotenv'
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

const getAllProducts = async (req, res) => {
    const { _end, _order, _start, _sort, title_like = "", productType = "" } = req.query;

    const query = {};

    if (productType !== ''){
        query.productType = productType;
    } 

    if(title_like) {
        query.title = { $regex: title_like, $options: 'i' }
    }

    try {
        const count = await Product.countDocuments({ query });

        const products = await Product
            .find(query)
            .limit(_end)
            .skip(_start)
            .sort({ [_sort]: _order })

        res.header('x-total-count', count);
        res.header('Access-Control-Expose-Headers','x-total-count');

        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: error.message })
    }

};

const getProductDetail = async (req, res) => {
    const { id } = req.params;
    const productExists = await Product.findOne({ _id: id}).populate('creator');

    if(productExists) {
        res.status(200).json(productExists) 
    }else {
        res.status(404).json({ message: 'Product not found'})
    }
};

const createProduct  = async (req, res) => {
    try {
        const { title, description, productType, location, price, photo, email } = req.body;

        //Start a new session
        const session = await mongoose.startSession();
        session.startTransaction();

        const user = await User.findOne({ email }).session(session);

        if(!user) throw new Error('User not found');

        const photoUrl = await cloudinary.uploader.upload(photo);    

        const newProduct = await Product.create({
            title,
            description,
            productType,
            location,
            price,
            photo: photoUrl.url,
            creator: user._id
        });

        user.allProperties.push(newProduct._id);
        await user.save({ session })

        await session.commitTransaction();

        res.status(200).json({ message: 'Product created successfully' })
    } catch (error) {
        res.status(500).json({ message: error.message})
    }
    
};

const updateProduct  = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, productType, location, price, photo} = req.body;

        const photoUrl = await cloudinary.uploader.upload(photo);

        await Product.findByIdAndUpdate({ _id: id}, {
            title,
            description,
            productType,
            location,
            price,
            photo: photoUrl.url || photo
        })

        res.status(200).json({ message: 'Product updated successfully'})
    } catch (error) {
        res.status(500).json({ message: error.message})
    }
};

const deleteProduct  = async (req, res) => {
    try {
        const { id } = req.params;

        const productToDelete = await Product.findById({_id: id}).populate('creator');

        if(!productToDelete) throw new Error('Product not Found');

        const session = await mongoose.startSession();
        session.startTransaction();

        productToDelete.remove({session});
        productToDelete.creator.allProperties.pull(productToDelete);

        await productToDelete.creator.save({session});
        await session.commitTransaction();

        res.status(200).json({ message: 'Product deleted successfully'});
    } catch (error) {
        res.status(500).json({ message: error.message});
    }
};

export {
    getAllProducts,
    getProductDetail,
    createProduct,
    updateProduct,
    deleteProduct,
}