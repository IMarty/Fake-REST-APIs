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
let nextAnimalId;
let nextPlanetId;
let nextExpeditionId;

// Fonction pour charger et réinitialiser les données des quatre projets
function loadInitialData() {
    try {
        const initialData = JSON.parse(fs.readFileSync('./initialData.json', 'utf8'));
        db = initialData;

        // Calculer les prochains ID pour toutes les collections
        const maxRecipeId = Math.max(...(db.recipes || []).map(r => r.id), 0);
        const maxAnimalId = Math.max(...(db.animals || []).map(a => a.id), 0);
        const maxPlanetId = Math.max(...(db.planets || []).map(p => p.id), 0);
        const maxExpeditionId = Math.max(...(db.expeditions || []).map(e => e.id), 0);

        nextRecipeId = maxRecipeId + 1;
        nextAnimalId = maxAnimalId + 1;
        nextPlanetId = maxPlanetId + 1;
        nextExpeditionId = maxExpeditionId + 1;

        console.log('Données Multi-API réinitialisées. Next IDs: R:', nextRecipeId, ', A:', nextAnimalId, ', P:', nextPlanetId, ', E:', nextExpeditionId);
    } catch (e) {
        console.error("Erreur lors du chargement des données initiales:", e);
        db = { recipes: [], animals: [], planets: [], expeditions: [] };
        nextRecipeId = 1;
        nextAnimalId = 1;
        nextPlanetId = 1;
        nextExpeditionId = 1;
    }
}

loadInitialData();

// --- 2. Middlewares de Base ---
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'correction')));

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
        enclosure: Joi.string().required(),
        age: Joi.number().integer().min(0).required(),
        health_status: Joi.string().valid('Sain', 'Malade', 'En quarantaine').default('Sain'),
        adoption_status: Joi.string().valid('Disponible', 'Non disponible', 'Adopté').default('Non disponible'),
        diet: Joi.array().items(Joi.string()),
        image: Joi.string().required()
    }),

    planet: Joi.object({
        name: Joi.string().min(2).required(),
        type: Joi.string().valid('Tellurique', 'Gazeuse', 'Lune').required(),
        distance_al: Joi.number().min(0).required(),
        gaseous: Joi.boolean().default(false),
        icon: Joi.string().required()
    }),

    // NOUVEAU: Schéma des expéditions
    expedition: Joi.object({
        title: Joi.string().min(5).required(),
        planet_id: Joi.number().integer().min(1).required().label('Planet ID'),
        date: Joi.string().isoDate().required(),
        status: Joi.string().valid('En cours', 'Terminée', 'Annulée').default('En cours'),
        crew_size: Joi.number().integer().min(1).default(3)
    })
};


// --- 5. Configuration Multer pour l'Upload (Générique) ---
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, 'uploads/'),
        filename: (req, file, cb) => cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }),
    limits: { fileSize: 5 * 1024 * 1024 }
}).single('photo');


// --- 6. Endpoint POST /upload (Générique) ---
app.post('/upload', (req, res) => {
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError || err || !req.file) {
            return res.status(400).send({ message: 'Upload failed. Field name must be "photo".' });
        }
        res.status(200).send({ filename: req.file.filename });
    });
});

// --- 7. Endpoint POST /reset (Réinitialisation des quatre collections) ---
app.post('/reset', (req, res) => {
    loadInitialData();
    res.status(200).send({ message: "La base de données des quatre projets a été réinitialisée." });
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
        newItem.id = getId();

        // Initialisation spécifique
        if (pluralName === 'recipes') newItem.likes = 0;
        if (pluralName === 'planets') {
            newItem.status = "Connue";
            newItem.discovery_date = new Date().toISOString().split('T')[0];
        }

        // NOUVEAU: Vérification de l'existence de la planète pour les expéditions
        if (pluralName === 'expeditions') {
            const planetId = newItem.planet_id;
            const planetExists = db.planets.some(p => p.id === planetId);
            if (!planetExists) {
                return res.status(400).send({ message: `La planète avec l'ID ${planetId} n'existe pas (Vérifiez les IDs existants).` });
            }
        }

        db[pluralName].push(newItem);
        res.status(201).send(newItem);
    });

    // GET (Lire la liste)
    app.get(`/${pluralName}`, (req, res) => {
        let list = db[pluralName];

        // --- Filtrage ---
        if (req.query.category) list = list.filter(item => item.category === req.query.category);
        if (req.query.species) list = list.filter(item => item.species === req.query.species);
        if (req.query.health_status) list = list.filter(item => item.health_status === req.query.health_status);
        if (req.query.type) list = list.filter(item => item.type === req.query.type);
        if (req.query.status && pluralName === 'expeditions') list = list.filter(item => item.status === req.query.status);
        if (req.query.planet_id && pluralName === 'expeditions') {
            const id = parseInt(req.query.planet_id);
            if (!isNaN(id)) {
                list = list.filter(item => item.planet_id === id);
            }
        }

        // --- Tri ---
        if (pluralName === 'recipes' && req.query._sort === 'likes' && req.query._order === 'desc') {
            list.sort((a, b) => b.likes - a.likes);
        }
        if (pluralName === 'planets' && req.query._sort === 'distance_al') {
            const order = req.query._order === 'desc' ? -1 : 1;
            list.sort((a, b) => (a.distance_al - b.distance_al) * order);
        }
        if (pluralName === 'expeditions' && req.query._sort === 'date') {
            const order = req.query._order === 'desc' ? -1 : 1;
            list.sort((a, b) => (new Date(a.date).getTime() - new Date(b.date).getTime()) * order);
        }

        // NOUVEAU: Jointure pour les expéditions (pour afficher le nom de la destination)
        if (pluralName === 'expeditions') {
            list = list.map(expedition => {
                const planet = db.planets.find(p => p.id === expedition.planet_id);
                return {
                    ...expedition,
                    destination_name: planet ? planet.name : 'Inconnue'
                };
            });
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

// Création des routes pour les quatre projets
createCollectionRoutes('recipe', schemas.recipe, () => nextRecipeId++);
createCollectionRoutes('animal', schemas.animal, () => nextAnimalId++);
createCollectionRoutes('planet', schemas.planet, () => nextPlanetId++);
createCollectionRoutes('expedition', schemas.expedition, () => nextExpeditionId++);

// --- 9. Démarrage du Serveur ---
app.listen(PORT, () => {
    console.log(`Serveur Multi-API prêt sur le port ${PORT}`);
    console.log(`Endpoints actifs: /recipes, /animals, /planets, /expeditions, /upload, /reset`);
});