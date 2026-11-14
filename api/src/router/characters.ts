import { Router } from "itty-router";
import * as characters from "../controller/characters";

export const routerCharacters = Router({ base: "/characters" })
  .get("/", characters.List)
  .get("/:unicode", characters.Info)
  .post("/", characters.Create)
  .post("/batch", characters.CreateBatch)
  .put("/batch", characters.UpdateBatch)
  .put("/:unicode", characters.Update)
  .delete("/", characters.DeleteAll)
  .delete("/batch", characters.DeleteBatch)
  .delete("/:unicode", characters.Delete);
