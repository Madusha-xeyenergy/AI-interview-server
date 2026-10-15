import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";



async function start(){
//connect first : 
  await connectDb();

  app.listen(env.PORT, () => {
  console.log(`AI Interview API running on http://localhost:${env.PORT}`);
});
}



const app = createApp();




start().catch((err) => {
  console.error("Failed to start the server:", err);
  process.exit(1);
});