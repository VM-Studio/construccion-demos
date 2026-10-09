import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => { console.log(await p.adjunto.findMany({ where: { id: { startsWith: "adj_" } , blobKey: { startsWith: "aceros-rnf/" } }, select: { id: true, blobKey: true, url: true, subidoPor: true } }), await p.remito.findUnique({ where: { id: "rem_0001" }, select: { firmadoAdjuntoId: true } })); await p.$disconnect(); })();
