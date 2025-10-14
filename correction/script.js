// Remplacez par l'URL de votre déploiement Render
const API_BASE_URL = 'https://fake-rest-apis.onrender.com'; // À changer après le déploiement

// --- Fonctions d'aide (pour les deux pages) ---

let allRecipes = []; // Stocke les données pour le filtrage client-side

function createRecipeCard(recipe) {
    const template = document.getElementById('recipe-card-template');
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.recipe-card');

    card.querySelector('h2').textContent = recipe.title;
    card.querySelector('.recipe-category').textContent = recipe.category;
    card.querySelector('.recipe-time').textContent = recipe.preparation_time_min;
    card.querySelector('.recipe-likes').textContent = recipe.likes;

    // Assurez-vous que l'image pointe vers l'endpoint statique
    card.querySelector('.recipe-photo').src = `${API_BASE_URL}/uploads/${recipe.photo}`;

    // Événements pour les boutons CRUD
    card.querySelector('.like-button').addEventListener('click', () => handleLike(recipe.id, card.querySelector('.recipe-likes')));
    card.querySelector('.delete-button').addEventListener('click', () => handleDelete(recipe.id, card));

    return clone;
}

function displayRecipes(list) {
    const listContainer = document.getElementById('recipes-list');
    if (!listContainer) return;
    listContainer.innerHTML = ''; // Nettoyer l'ancien contenu

    if (list.length === 0) {
        listContainer.innerHTML = '<p>Aucune recette trouvée pour ce filtre.</p>';
        return;
    }

    list.forEach(recipe => {
        listContainer.appendChild(createRecipeCard(recipe));
    });
}

// --- Logique CRUD ---

async function fetchRecipes() {
    try {
        const response = await fetch(`${API_BASE_URL}/recipes`);
        if (!response.ok) throw new Error('Erreur lors de la récupération des recettes');

        allRecipes = await response.json();
        displayRecipes(allRecipes);
    } catch (error) {
        console.error('Fetch error:', error);
        document.getElementById('recipes-list').innerHTML = `<p class="error">Impossible de charger les recettes: ${error.message}</p>`;
    }
}

async function handleLike(id, likesElement) {
    try {
        const response = await fetch(`${API_BASE_URL}/recipes/${id}`);
        const recipe = await response.json();

        const newLikes = recipe.likes + 1;

        await fetch(`${API_BASE_URL}/recipes/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ likes: newLikes })
        });

        likesElement.textContent = newLikes;
        // Mettre à jour les données locales pour le tri/filtrage
        const localRecipe = allRecipes.find(r => r.id === id);
        if (localRecipe) localRecipe.likes = newLikes;

    } catch (error) {
        console.error('Like error:', error);
        alert('Erreur lors de l\'ajout d\'un like.');
    }
}

async function handleDelete(id, cardElement) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette recette ?")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/recipes/${id}`, {
            method: 'DELETE'
        });

        if (response.status === 204) {
            cardElement.remove(); // Suppression côté DOM
            allRecipes = allRecipes.filter(r => r.id !== id); // Suppression côté données
        } else {
            alert('Erreur lors de la suppression.');
        }

    } catch (error) {
        console.error('Delete error:', error);
    }
}

// NOUVELLE FONCTION : Gestion de la réinitialisation des données
async function handleReset() {
    const statusDiv = document.getElementById('reset-status');
    statusDiv.className = 'messages';
    statusDiv.textContent = 'Réinitialisation en cours...';

    if (!confirm("ATTENTION : Voulez-vous vraiment supprimer TOUTES les modifications et recharger les données de base ?")) {
        statusDiv.textContent = 'Réinitialisation annulée.';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/reset`, {
            method: 'POST'
            // Pas de body nécessaire
        });

        if (!response.ok) throw new Error("Échec de la réinitialisation du serveur.");

        // Recharger les données et les afficher après succès
        await fetchRecipes();
        statusDiv.className = 'success';
        statusDiv.textContent = 'Base de données réinitialisée avec succès !';

    } catch (error) {
        console.error('Reset error:', error);
        statusDiv.className = 'error';
        statusDiv.textContent = `Erreur de réinitialisation : ${error.message}`;
    } finally {
        // Effacer le message après 3 secondes
        setTimeout(() => { statusDiv.textContent = ''; statusDiv.className = 'messages'; }, 3000);
    }
}


// --- Logique Page d'Accueil (index.html) ---

function initHomePage() {
    fetchRecipes();

    // Gestion de la Réinitialisation
    document.getElementById('reset-button')?.addEventListener('click', handleReset);

    // Gestion du Filtrage
    document.getElementById('filter-buttons')?.addEventListener('click', (event) => {
        if (event.target.tagName !== 'BUTTON') return;

        document.querySelectorAll('#filter-buttons button').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');

        const filterCategory = event.target.dataset.filter;
        let filteredList = allRecipes;

        if (filterCategory !== 'all') {
            filteredList = allRecipes.filter(r => r.category === filterCategory);
        }

        // Réappliquer le tri après le filtrage
        handleSort(filteredList);
    });

    // Gestion du Tri
    document.getElementById('sort-select')?.addEventListener('change', (event) => {
        handleSort(allRecipes); // Trie la liste complète, puis l'affiche
    });
}

function handleSort(list) {
    const sortValue = document.getElementById('sort-select').value;
    let sortedList = [...list]; // Copie de la liste

    if (sortValue === 'likes-desc') {
        sortedList.sort((a, b) => b.likes - a.likes);
    }

    displayRecipes(sortedList);
}


// --- Logique Page d'Ajout (ajout.html) ---

function initAddPage() {
    const form = document.getElementById('add-recipe-form');
    if (!form) return;

    let uploadedFilename = 'default_recipe.jpg'; // Nom de fichier par défaut
    const uploadStatusDiv = document.getElementById('upload-status');
    const photoFileInput = document.getElementById('photo-file');


    // Gère le téléversement de fichier (étape 1)
    photoFileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        uploadStatusDiv.textContent = 'Téléversement en cours...';

        const formData = new FormData();
        formData.append('recipe-photo', file);

        try {
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Échec de l\'upload');

            const result = await response.json();
            uploadedFilename = result.filename;
            uploadStatusDiv.innerHTML = `Photo uploadée avec succès ! Nom: <strong>${uploadedFilename}</strong>`;

        } catch (error) {
            console.error('Upload error:', error);
            uploadStatusDiv.innerHTML = `<span style="color:red;">Erreur: ${error.message}</span>`;
            uploadedFilename = 'default_recipe.jpg';
        }
    });


    // Gère la soumission du formulaire (étape 2)
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const data = {
            title: form.title.value,
            category: form.category.value,
            preparation_time_min: parseInt(form.preparation_time_min.value),
            ingredients: form.ingredients.value.split(',').map(s => s.trim()).filter(s => s),
            is_vegetarian: form.is_vegetarian.checked,
            photo: uploadedFilename
        };

        try {
            const response = await fetch(`${API_BASE_URL}/recipes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || 'Erreur lors de la validation ou de la création.');
            }

            form.reset();
            uploadedFilename = 'default_recipe.jpg';
            uploadStatusDiv.innerHTML = '';
            document.getElementById('messages').innerHTML = '<p class="success">Recette ajoutée avec succès !</p>';

        } catch (error) {
            console.error('Post error:', error);
            document.getElementById('messages').innerHTML = `<p class="error">Erreur d\'API: ${error.message}</p>`;
        }
    });
}


// Démarrage
if (document.getElementById('recipes-list')) {
    initHomePage();
} else if (document.getElementById('add-recipe-form')) {
    initAddPage();
}