import { Router } from "itty-router";
import * as glyphs from "../controller/glyphs";

export const routerGlyphs = Router({ base: "/glyphs" })
  .get("/", glyphs.List)
  .get("/:id", glyphs.Info)
  .post("/", glyphs.Create)
  .post("/batch", glyphs.CreateBatch)
  .put("/", glyphs.ReplaceId)
  .put("/batch", glyphs.UpdateBatch)
  .put("/:id", glyphs.Update)
  .delete("/", glyphs.DeleteAll)
  .delete("/batch", glyphs.DeleteBatch)
  .delete("/:id", glyphs.Delete);
