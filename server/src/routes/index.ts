import { Router } from 'express';
import { animalRouter } from './animal';
import { recognizeRouter } from './recognize';
import { searchRouter } from './search';
import { taxonomyRouter } from './taxonomy';

export const apiRouter = Router();

apiRouter.use(animalRouter);
apiRouter.use(recognizeRouter);
apiRouter.use(searchRouter);
apiRouter.use(taxonomyRouter);
