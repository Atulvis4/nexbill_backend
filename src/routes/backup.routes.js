import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import backupController from '../controllers/backup.controller.js';
import authenticate from '../middlewares/authenticate.js';
import extractBusiness from '../middlewares/extractBusiness.js';

const uploadDir = 'uploads/backups';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.vyp';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 300 * 1024 * 1024 }, // 300 MB for large SQLite databases
});

const backupRoutes = Router();

backupRoutes.use(authenticate);
backupRoutes.use(extractBusiness);

backupRoutes.post('/export', backupController.exportBackup);
backupRoutes.post('/restore', upload.single('backupFile'), backupController.restoreBackup);
backupRoutes.post('/upload-vyapar', upload.single('backupFile'), backupController.uploadVyaparBackup);

export { backupRoutes };
export default backupRoutes;
