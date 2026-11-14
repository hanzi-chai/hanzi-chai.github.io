import { Router } from "itty-router";
import * as users from "../controller/users";
import {
  authorizedAdmin,
  authorizedSuper,
  authorizedUser,
} from "../middleware/jwt";

export const routerUsers = Router({ base: "/users" })
  .get("/:id", users.Info)
  .post("/", users.Create)
  .delete("/:id", authorizedUser, authorizedAdmin, users.Delete)
  .put("/:id", authorizedUser, users.Update)
  .put("/:id/promote", authorizedUser, authorizedSuper, users.Promote)
  .put("/:id/disable", authorizedUser, authorizedSuper, users.Disable);
