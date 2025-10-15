// correction/models.ts

// --- Types pour les statuts Zoopédia ---
export type HealthStatus = 'Sain' | 'Malade' | 'En quarantaine';
export type AdoptionStatus = 'Disponible' | 'Non disponible' | 'Adopté';

export interface Animal {
    id: number;
    name: string;
    species: string;
    enclosure: string;
    age: number;
    health_status: HealthStatus;
    adoption_status: AdoptionStatus;
    diet: string[];
    image: string; // Nom du fichier
}

// --- Interfaces Génériques ---
export interface UploadResponse {
    filename: string;
}

export interface ApiError {
    message: string;
    details?: string;
}

// Type pour les données envoyées lors de la création (sans l'ID et les statuts par défaut)
export type AnimalCreationData = Omit<Animal, 'id' | 'health_status' | 'adoption_status' | 'diet'>;