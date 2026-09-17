import "./style.css";
import { seed } from "./data/seed";
import { initRouter } from "./router";
import { initTheme } from "./services/preferences.service";

async function bootstrap(): Promise<void> {
  await seed();
  initTheme();
  initRouter();
}

void bootstrap();
