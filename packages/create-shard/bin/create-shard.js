#!/usr/bin/env node
import { runCreateShard } from "../dist/index.js";

runCreateShard().catch((err) => {
  console.error(err);
  process.exit(1);
});
