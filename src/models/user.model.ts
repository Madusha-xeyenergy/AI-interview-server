import { HydratedDocument, InferSchemaType, Schema , model} from "mongoose"
;
export const USER_ROLES = ["admin", "recruiter"] as const;
export type UserRole = (typeof USER_ROLES)[number];


const userSchema = new Schema(
    {
        name: {type: String,  required: true,trim: true},
        email: {type: String, required: true, unique: true, lowercase: true, trim: true},
        // select: false → never loaded unless a query asks for it with .select("+passwordHash")
        passwordHash: {type: String, required: true, select: false},
        role: {type: String, enum: USER_ROLES, required: true, default: "recruiter"},

    },
    {timestamps: true}
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;

export const UserModel = model("User", userSchema);

/** dto for the user */
export type PublicUser = {
    id: string;
    name: string;
    email: string;
    role: UserRole;
};

export function toPublicUser(user: UserDocument): PublicUser {
    return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role as UserRole,
    };
}