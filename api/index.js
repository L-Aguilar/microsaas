import { createServer } from '../server/index.js';

let app = null;

async function getApp() {
  if (!app) {
    app = await createServer();
  }
  return app;
}

export default async function handler(req, res) {
  const app = await getApp();
  return app(req, res);
}