const express = require('express');
const Joi = require('joi');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

let db;
let nextRecipeId;

// Fonction pour charger et réinitialiser les données
function loadInitialData() {
    try {
        const initialData = JSON.parse(fs.readFileSync('./initialData.json', 'utf8'));
        db = initialData;
        // Calculer le prochain ID disponible
        nextRecipeId = Math.max(...db.recipes.map(r => r.id), 0) + 1;
        console.log('Données réinitialisées avec succès.');
    } catch (e) {
        console.error("Erreur lors du chargement des données initiales:", e);
        db = { recipes: [] };
        nextRecipeId = 1;
    }
}

// Chargement initial au démarrage
loadInitialData();

// --- 2. Middlewares de Base ---
app.use(express.json());

// Servir les fichiers statiques (correction et uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/correction', express.static(path.join(__dirname, 'correction')));

// Middleware CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// --- 3. Documentation Swagger ---
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// --- 4. Schéma de Validation (Joi) ---
const recipeSchema = Joi.object({
    title: Joi.string().min(3).required(),
    category: Joi.string().valid('Entrée', 'Plat Principal', 'Dessert').required(),
    preparation_time_min: Joi.number().integer().min(1).required(),
    ingredients: Joi.array().items(Joi.string()).min(1).required(),
    is_vegetarian: Joi.boolean().default(false),
    photo: Joi.string().required()
});

// --- 5. Configuration Multer pour l'Upload (Simulé) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + Date.now() + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
}).single('recipe-photo');

// --- 6. Endpoint POST /upload (Gestion du Fichier) ---
app.post('/upload', (req, res) => {
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(400).send({ message: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(500).send({ message: `Server error during upload: ${err.message}` });
        }

        if (!req.file) {
            return res.status(400).send({ message: 'No file uploaded. Field name must be "recipe-photo".' });
        }

        res.status(200).send({ filename: req.file.filename });
    });
});

// --- 7. Nouvel Endpoint de Réinitialisation ---
app.post('/reset', (req, res) => {
    loadInitialData(); // Recharger les données du JSON
    res.status(200).send({ message: "La base de données des recettes a été réinitialisée." });
});

// --- 8. Routes CRUD pour /recipes ---

app.post('/recipes', (req, res) => {
    const { error } = recipeSchema.validate(req.body);

    if (error) {
        return res.status(400).send({ message: 'Validation failed', details: error.details[0].message });
    }

    const newRecipe = req.body;
    newRecipe.id = nextRecipeId++;
    newRecipe.likes = 0;

    db.recipes.push(newRecipe);
    res.status(201).send(newRecipe);
});

app.get('/recipes', (req, res) => {
    let list = db.recipes;

    if (req.query.category) {
        list = list.filter(r => r.category === req.query.category);
    }

    if (req.query._sort === 'likes' && req.query._order === 'desc') {
        list.sort((a, b) => b.likes - a.likes);
    }

    res.send(list);
});

app.get('/recipes/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const item = db.recipes.find(i => i.id === id);
    if (!item) return res.status(404).send({ message: `Recipe not found.` });
    res.send(item);
});

app.patch('/recipes/:id', (req, res) => {
    const id = parseInt(req.params.id);
    let itemIndex = db.recipes.findIndex(i => i.id === id);
    if (itemIndex === -1) return res.status(404).send({ message: `Recipe not found.` });

    db.recipes[itemIndex] = { ...db.recipes[itemIndex], ...req.body };
    res.send(db.recipes[itemIndex]);
});

app.delete('/recipes/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const initialLength = db.recipes.length;

    db.recipes = db.recipes.filter(i => i.id !== id);

    if (db.recipes.length === initialLength) {
        return res.status(404).send({ message: `Recipe not found.` });
    }
    res.status(204).send();
});


// --- 9. Démarrage du Serveur ---
app.listen(PORT, () => {
    console.log(`Recipe Vault API prêt sur le port ${PORT}`);
    console.log(`Endpoint de réinitialisation: POST /reset`);
});