// correction/index-page.ts

import { Animal, HealthStatus, AdoptionStatus } from './models';

const API_BASE_URL: string = 'https://fake-rest-apis.onrender.com';
let allAnimals: Animal[] = [];
const healthStatuses: HealthStatus[] = ['Sain', 'Malade', 'En quarantaine'];


// ******************************************************
// PARTIE 1: Récupération des données et Affichage initial
// ******************************************************

/** Crée et configure la carte DOM pour une fiche animale. */
function createAnimalCard(animal: Animal): DocumentFragment {
    const template = document.getElementById('animal-card-template') as HTMLTemplateElement;
    const clone = template.content.cloneNode(true) as DocumentFragment;
    const card = clone.querySelector('.animal-card') as HTMLElement;

    // Remplissage des données
    (card.querySelector('h2') as HTMLHeadingElement).textContent = animal.name;
    (card.querySelector('.animal-species') as HTMLSpanElement).textContent = animal.species;
    (card.querySelector('.animal-enclosure') as HTMLSpanElement).textContent = animal.enclosure;
    (card.querySelector('.animal-health') as HTMLSpanElement).textContent = animal.health_status;

    // Ajout de la classe CSS pour le statut de santé
    card.classList.add(`status-${animal.health_status.replace(/\s/g, '-')}`);

    // Construction de l'URL pour l'image
    (card.querySelector('.animal-photo') as HTMLImageElement).src = `${API_BASE_URL}/uploads/${animal.image}`;

    // Événements (partie 3)
    const healthElement = card.querySelector('.animal-health') as HTMLSpanElement;
    const statusButton = card.querySelector('.status-toggle-button') as HTMLButtonElement;
    const deleteButton = card.querySelector('.delete-button') as HTMLButtonElement;

    statusButton.addEventListener('click', () => handleStatusToggle(animal.id, healthElement, card));
    deleteButton.addEventListener('click', () => handleDelete(animal.id, card));

    return clone;
}

/** Nettoie le conteneur et affiche la liste donnée. */
function displayAnimals(list: Animal[]): void {
    const listContainer = document.getElementById('animals-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (list.length === 0) {
        listContainer.innerHTML = '<p>Aucun animal trouvé pour ce filtre.</p>';
        return;
    }

    list.forEach(animal => {
        listContainer.appendChild(createAnimalCard(animal));
    });
}

/** Récupère les animaux depuis l'API et initialise l'affichage. */
async function fetchAnimals(): Promise<void> {
    try {
        const listContainer = document.getElementById('animals-list') as HTMLElement;
        listContainer.innerHTML = '<p>Chargement des fiches...</p>';

        const response = await fetch(`${API_BASE_URL}/animals`);
        if (!response.ok) throw new Error('Erreur de réseau ou serveur.');

        allAnimals = await response.json() as Animal[];
        displayAnimals(allAnimals);
    } catch (error) {
        console.error('Fetch error:', error);
        (document.getElementById('animals-list') as HTMLElement).innerHTML = `<p class="error">Impossible de charger les fiches: ${(error as Error).message}</p>`;
    }
}


// ******************************************************
// PARTIE 2: Filtrage (Logique Côté Client)
// ******************************************************

function handleFilter(filterType: 'all' | 'Disponible' | 'Malade'): void {
    // Mise à jour de l'état visuel des boutons
    document.querySelectorAll('#filter-buttons button').forEach(btn => btn.classList.remove('active'));
    const targetButton = document.querySelector(`[data-filter="${filterType}"]`);
    if (targetButton) targetButton.classList.add('active');

    let filteredList = allAnimals;

    if (filterType === 'Disponible') {
        filteredList = allAnimals.filter(a => a.adoption_status === 'Disponible');
    } else if (filterType === 'Malade') {
        filteredList = allAnimals.filter(a => a.health_status === 'Malade');
    }

    displayAnimals(filteredList);
}


// ******************************************************
// PARTIE 3: Opérations CRUD (PATCH, DELETE)
// ******************************************************

/** Gère le changement de statut de santé (toggle) via PATCH. */
async function handleStatusToggle(id: number, statusElement: HTMLSpanElement, cardElement: HTMLElement): Promise<void> {
    try {
        const currentStatus = statusElement.textContent as HealthStatus;
        const currentIndex = healthStatuses.indexOf(currentStatus);
        const nextIndex = (currentIndex + 1) % healthStatuses.length;
        const newStatus = healthStatuses[nextIndex];

        // Requête PATCH pour mettre à jour le statut
        await fetch(`${API_BASE_URL}/animals/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ health_status: newStatus })
        });

        // Mise à jour DOM
        statusElement.textContent = newStatus;

        // Mise à jour des classes CSS pour le style
        cardElement.classList.remove(...healthStatuses.map(s => `status-${s.replace(/\s/g, '-')}`));
        cardElement.classList.add(`status-${newStatus.replace(/\s/g, '-')}`);

        // Mise à jour locale
        const localAnimal = allAnimals.find(a => a.id === id);
        if (localAnimal) localAnimal.health_status = newStatus;

    } catch (error) {
        alert('Erreur lors de la modification du statut de santé.');
    }
}

/** Gère la suppression de l'animal (Adoption Finalisée/Retrait). */
async function handleDelete(id: number, cardElement: HTMLElement): Promise<void> {
    if (!confirm("CONFIRMEZ : Retirer définitivement cette fiche animale ?")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/animals/${id}`, { method: 'DELETE' });

        if (response.status === 204) {
            cardElement.remove();
            allAnimals = allAnimals.filter(a => a.id !== id);
        } else {
            alert('Erreur lors du retrait de la fiche.');
        }

    } catch (error) {
        alert('Erreur lors de la suppression.');
    }
}

/** Gère la réinitialisation de la base de données. */
async function handleReset(): Promise<void> {
    const statusDiv = document.getElementById('reset-status') as HTMLParagraphElement;
    statusDiv.className = 'messages';
    statusDiv.textContent = 'Réinitialisation en cours...';

    if (!confirm("ATTENTION : Voulez-vous vraiment réinitialiser la base de données Zoopédia ?")) {
        statusDiv.textContent = 'Réinitialisation annulée.';
        return;
    }

    try {
        await fetch(`${API_BASE_URL}/reset`, { method: 'POST' });
        await fetchAnimals();

        statusDiv.className = 'success';
        statusDiv.textContent = 'Base de données réinitialisée avec succès !';

    } catch (error) {
        statusDiv.className = 'error';
        statusDiv.textContent = `Erreur de réinitialisation : ${(error as Error).message}`;
    } finally {
        setTimeout(() => { statusDiv.textContent = ''; statusDiv.className = 'messages'; }, 3000);
    }
}


// ******************************************************
// PARTIE 4: Initialisation (Point de départ)
// ******************************************************

export function initHomePage(): void {
    fetchAnimals();

    // Événements de Réinitialisation
    document.getElementById('reset-button')?.addEventListener('click', handleReset);

    // Événements de Filtrage
    document.getElementById('filter-buttons')?.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'BUTTON') {
            handleFilter(target.dataset.filter as 'all' | 'Disponible' | 'Malade' || 'all');
        }
    });
}