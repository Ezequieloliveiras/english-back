import { app } from "./app";
import { connectDatabase } from "./config/database";
import { env } from "./config/env";

const start = async () => {
  await connectDatabase();

  app.listen(env.port, () => {
    console.log(`English OS API running on port ${env.port}`);
  });
};

void start();
