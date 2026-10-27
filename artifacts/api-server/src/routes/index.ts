import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import assignmentsRouter from "./assignments";
import authRouter from "./auth";
import feedRouter from "./feed";
import healthRouter from "./health";
import lecturesRouter from "./lectures";
import liveRouter from "./live";
import miscRouter from "./misc";
import parentRouter from "./parent";
import paymentsRouter from "./payments";
import walletRouter from "./wallet";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(lecturesRouter);
router.use(feedRouter);
router.use(liveRouter);
router.use(paymentsRouter);
router.use(assignmentsRouter);
router.use(walletRouter);
router.use(parentRouter);
router.use(adminRouter);
router.use(miscRouter);

export default router;
