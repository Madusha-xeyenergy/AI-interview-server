import mongoose, { Types } from "mongoose";
import { Readable } from "node:stream";

// GridFS stores a file in chunks across two collections (resumes.files + resumes.chunks)
// in the same database, so CVs need no separate storage service.
const resumeBucket = () => {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB is not connected");
  }
  return new mongoose.mongo.GridFSBucket(db, { bucketName: "resumes" });
};

/** Uploads a file buffer and resolves with the new GridFS file id. */
const saveResumeFile = (buffer: Buffer, filename: string, contentType: string) => {
  return new Promise<Types.ObjectId>((resolve, reject) => {
    const uploadStream = resumeBucket().openUploadStream(filename, {
      metadata: { contentType },
    });

    Readable.from(buffer)
      .pipe(uploadStream)
      .on("error", reject)
      .on("finish", () => resolve(uploadStream.id as Types.ObjectId));
  });
};

const openResumeStream = (fileId: Types.ObjectId) => resumeBucket().openDownloadStream(fileId);

const deleteResumeFile = (fileId: Types.ObjectId) => resumeBucket().delete(fileId);

export { saveResumeFile, openResumeStream, deleteResumeFile };
