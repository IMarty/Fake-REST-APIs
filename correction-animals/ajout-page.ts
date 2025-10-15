// correction/ajout-page.ts

import { AnimalCreationData, UploadResponse, ApiError } from './models';

const API_BASE_URL: string = 'https://fake-rest-apis.onrender.com';


// ******************************************************
// PARTIE 1: Gestion de l'Upload de la Photo de l'Animal
// ******************************************************

/** Gère l'upload de fichier vers l'endpoint /upload. */
async function handleFileUpload(file: File, uploadStatusDiv: HTMLDivElement): Promise<string> {
    uploadStatusDiv.textContent = 'Téléversement en cours...';

    const formData = new FormData();
    formData.append('photo', file); // Le nom 'photo' doit correspondre au serveur

    try {
        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json() as ApiError;
            throw new Error(errorData.message || 'Échec de l\'upload du fichier.');
        }

        const result = await response.json() as UploadResponse;
        uploadStatusDiv.innerHTML = `Photo uploadée : <strong>${result.filename}</strong>`;
        return result.filename;

    } catch (error) {
        uploadStatusDiv.innerHTML = `<span class="error">Erreur d'upload: ${(error as Error).message}</span>`;
        return 'default_animal.png'; // Retourne une image par défaut en cas d'échec
    }
}


// ******************************************************
// PARTIE 2: Soumission du Formulaire (POST /animals)
// ******************************************************

async function handleFormSubmit(event: Event, form: HTMLFormElement, uploadedFilename: string): Promise<void> {
    event.preventDefault();

    const messagesDiv = document.getElementById('messages') as HTMLDivElement;

    // Création de l'objet de données typé pour la POST
    const data: AnimalCreationData = {
        name: (form.elements.namedItem('name') as HTMLInputElement).value,
        species: (form.elements.namedItem('species') as HTMLInputElement).value,
        enclosure: (form.elements.namedItem('enclosure') as HTMLInputElement).value,
        age: parseInt((form.elements.namedItem('age') as HTMLInputElement).value),
        image: uploadedFilename // Utilisation du nom de fichier obtenu après l'upload
    };

    try {
        const response = await fetch(`${API_BASE_URL}/animals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json() as ApiError;
            throw new Error(errorData.details || errorData.message || 'Erreur inconnue de l\'API.');
        }

        form.reset();
        (document.getElementById('upload-status') as HTMLDivElement).innerHTML = '';
        messagesDiv.innerHTML = '<p class="success">Fiche animale créée avec succès !</p>';

    } catch (error) {
        messagesDiv.innerHTML = `<p class="error">Erreur d\'API: ${(error as Error).message}</p>`;
    }
}


// ******************************************************
// PARTIE 3: Initialisation
// ******************************************************

export function initAddPage(): void {
    const form = document.getElementById('add-animal-form') as HTMLFormElement | null;
    if (!form) return;

    let uploadedFilename: string = 'default_animal.png';
    const uploadStatusDiv = document.getElementById('upload-status') as HTMLDivElement;
    const photoFileInput = document.getElementById('photo-file') as HTMLInputElement;

    // 3.1. Gestion du changement de fichier (Upload)
    photoFileInput.addEventListener('change', async (event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files ? target.files[0] : null;

        if (file) {
            uploadedFilename = await handleFileUpload(file, uploadStatusDiv);
        } else {
            uploadedFilename = 'default_animal.png';
            uploadStatusDiv.innerHTML = '';
        }
    });


    // 3.2. Gestion de la soumission du formulaire (POST)
    form.addEventListener('submit', (event: Event) => {
        handleFormSubmit(event, form, uploadedFilename);
    });
}