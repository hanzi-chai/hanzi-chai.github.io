import { Router } from "itty-router";
import * as characters from "../controller/characters";

export const routerCharacters = Router({ base: "/characters" })
  .get("/", characters.List)
  .get("/:unicode", characters.Info)
  .post("/", characters.Create)
  .post("/batch", characters.CreateBatch)
  .put("/:unicode", characters.Update)
  .delete("/:unicode", characters.Delete);
