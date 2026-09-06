import { Router } from 'express';
import { getAnimalById } from '../services/animalService';

export const animalRouter = Router();

animalRouter.get('/animal/:id', (req, res) => {
  const id = String(req.params.id || '');
  getAnimalById(id)
    .then(data => {
      res.status(200).json({ success: true, data });
    })
    .catch(() => {
      res.status(500).json({
        success: false,
        error: {
          code: 'ANIMAL_FETCH_FAILED',
          message: 'Failed to fetch animal data',
        },
      });
    });
});
