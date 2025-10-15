const express = require('express');
const Joi = require('joi');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json'); // Assurez-vous que ce fichier est mis à jour
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

let db;
let nextRecipeId;
let nextAnimalId;

// Fonction pour charger et réinitialiser les données des deux projets
function loadInitialData() {
    try {
        const initialData = JSON.parse(fs.readFileSync('./initialData.json', 'utf8'));
        db = initialData;

        // Calculer les prochains ID pour les deux collections
        const maxRecipeId = Math.max(...(db.recipes || []).map(r => r.id), 0);
        const maxAnimalId = Math.max(...(db.animals || []).map(a => a.id), 0);
        nextRecipeId = maxRecipeId + 1;
        nextAnimalId = maxAnimalId + 1;

        console.log('Données Multi-API réinitialisées. Prochains IDs: Recette:', nextRecipeId, ', Animal:', nextAnimalId);
    } catch (e) {
        console.error("Erreur lors du chargement des données initiales:", e);
        db = { recipes: [], animals: [] };
        nextRecipeId = 1;
        nextAnimalId = 1;
    }
}

loadInitialData();

// --- 2. Middlewares de Base ---
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/correction-recettes', express.static(path.join(__dirname, 'correction-recettes')));
app.use('/correction-animals', express.static(path.join(__dirname, 'correction-animals')));

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

// --- 4. Schémas de Validation (Joi) ---
const schemas = {
    recipe: Joi.object({
        title: Joi.string().min(3).required(),
        category: Joi.string().valid('Entrée', 'Plat Principal', 'Dessert').required(),
        preparation_time_min: Joi.number().integer().min(1).required(),
        ingredients: Joi.array().items(Joi.string()).min(1).required(),
        is_vegetarian: Joi.boolean().default(false),
        photo: Joi.string().required()
    }),
    animal: Joi.object({
        name: Joi.string().min(2).max(50).required(),
        species: Joi.string().required(),
        enclosure: Joi.string(),
        age: Joi.number().integer().min(0),
        health_status: Joi.string().valid('Sain', 'Malade', 'En quarantaine').default('Sain'),
        adoption_status: Joi.string().valid('Disponible', 'Non disponible', 'Adopté').default('Non disponible'),
        diet: Joi.array().items(Joi.string()),
        image: Joi.string()
    })
};


// --- 5. Configuration Multer pour l'Upload (Générique) ---
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, 'uploads/'),
        filename: (req, file, cb) => cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }),
    limits: { fileSize: 5 * 1024 * 1024 }
}).single('photo'); // Le champ 'photo' est utilisé comme nom générique dans le formulaire de l'élève


// --- 6. Endpoint POST /upload (Générique) ---
app.post('/upload', (req, res) => {
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError || err || !req.file) {
            return res.status(400).send({ message: 'Upload failed. Field name must be "photo".' });
        }
        res.status(200).send({ filename: req.file.filename });
    });
});

// --- 7. Endpoint POST /reset (Réinitialisation des deux collections) ---
app.post('/reset', (req, res) => {
    loadInitialData();
    res.status(200).send({ message: "La base de données des recettes et animaux a été réinitialisée." });
});

// --- 8. Routes CRUD (Génériques et Spécifiques) ---

// Fonction générique pour manipuler les collections
function createCollectionRoutes(collectionName, schema, getId) {
    const pluralName = collectionName + 's';

    // POST (Créer)
    app.post(`/${pluralName}`, (req, res) => {
        const { error } = schema.validate(req.body);
        if (error) return res.status(400).send({ message: 'Validation failed', details: error.details[0].message });

        const newItem = req.body;
        newItem.id = getId(); // Utilise la fonction de ID appropriée

        if (pluralName === 'recipes') newItem.likes = 0; // Initialisation spécifique aux recettes

        db[pluralName].push(newItem);
        res.status(201).send(newItem);
    });

    // GET (Lire la liste)
    app.get(`/${pluralName}`, (req, res) => {
        let list = db[pluralName];

        // Logique de filtrage simple (ex: /recipes?category=Dessert ou /animals?species=Lion)
        if (req.query.category) list = list.filter(item => item.category === req.query.category);
        if (req.query.species) list = list.filter(item => item.species === req.query.species);
        if (req.query.health_status) list = list.filter(item => item.health_status === req.query.health_status);

        // Logique de tri (ex: /recipes?_sort=likes&_order=desc)
        if (pluralName === 'recipes' && req.query._sort === 'likes' && req.query._order === 'desc') {
            list.sort((a, b) => b.likes - a.likes);
        }

        res.send(list);
    });

    // GET par ID
    app.get(`/${pluralName}/:id`, (req, res) => {
        const id = parseInt(req.params.id);
        const item = db[pluralName].find(i => i.id === id);
        if (!item) return res.status(404).send({ message: `${collectionName} not found.` });
        res.send(item);
    });

    // PATCH (Modifier partiellement)
    app.patch(`/${pluralName}/:id`, (req, res) => {
        const id = parseInt(req.params.id);
        let itemIndex = db[pluralName].findIndex(i => i.id === id);
        if (itemIndex === -1) return res.status(404).send({ message: `${collectionName} not found.` });

        db[pluralName][itemIndex] = { ...db[pluralName][itemIndex], ...req.body };
        res.send(db[pluralName][itemIndex]);
    });

    // DELETE
    app.delete(`/${pluralName}/:id`, (req, res) => {
        const id = parseInt(req.params.id);
        const initialLength = db[pluralName].length;

        db[pluralName] = db[pluralName].filter(i => i.id !== id);

        if (db[pluralName].length === initialLength) return res.status(404).send({ message: `${collectionName} not found.` });
        res.status(204).send();
    });
}

// Création des routes pour les Recettes
createCollectionRoutes('recipe', schemas.recipe, () => nextRecipeId++);

// Création des routes pour les Animaux
createCollectionRoutes('animal', schemas.animal, () => nextAnimalId++);

// --- 9. Démarrage du Serveur ---
app.listen(PORT, () => {
    console.log(`Serveur Multi-API prêt sur le port ${PORT}`);
    console.log(`Endpoints actifs: /recipes, /animals, /upload, /reset, /api-docs`);
});