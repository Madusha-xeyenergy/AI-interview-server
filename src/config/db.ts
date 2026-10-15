import mongoose from "mongoose";

import {env} from "./env.js";

//One shared connection for the whole app. Mongoose keeps a connection

export async function connectDb(){
    mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected"));
    mongoose.connection.on("error", (err) => console.error("MongoDB error: ", err));

    await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10_1000,
    });

    console.log(`MongoDB connected : ${mongoose.connection.name}`);
}

export function isDbConnected(): boolean{
    //readyState 1 means connected, 2 means connecting, 3 means disconnecting, 0 means disconnected
    return mongoose.connection.readyState === 1;
}