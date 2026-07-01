import { Router } from "itty-router";
import * as glyphs from "../controller/glyphs";

export const routerGlyphs = Router({ base: "/glyphs" })
  .get("/", glyphs.List)
  .get("/:id", glyphs.Info)
  .post("/", glyphs.Create)
  .post("/batch", glyphs.CreateBatch)
  .put("/:id", glyphs.Update)
  .delete("/:id", glyphs.Delete);
