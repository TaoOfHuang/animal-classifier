import { Router } from 'express';
import { getTaxonomyTree } from '../services/taxonomyService';

export const taxonomyRouter = Router();

taxonomyRouter.get('/taxonomy/:level/:name', (req, res) => {
  const level = String(req.params.level || '');
  const name = String(req.params.name || '');
  getTaxonomyTree(level, name)
    .then(data => {
      res.status(200).json({
        success: true,
        data,
      });
    })
    .catch(() => {
      res.status(200).json({
        success: true,
        data: {
          current: { level, scientificName: name, commonNameZh: `${name}分类` },
          parent: null,
          children: [],
        },
      });
    });
});
