import "./style.css";
import { seed } from "./data/seed";
import { initRouter } from "./router";

async function bootstrap(): Promise<void> {
  await seed();
  initRouter();
}

void bootstrap();
