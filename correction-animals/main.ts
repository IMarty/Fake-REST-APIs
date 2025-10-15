// correction/main.ts

import { initHomePage } from './index-page';
import { initAddPage } from './ajout-page';

/** Détermine quelle page est chargée et initialise le module correspondant. */
function bootstrap(): void {
    if (document.getElementById('animals-list')) {
        initHomePage();
    } else if (document.getElementById('add-animal-form')) {
        initAddPage();
    }
}

// Démarrage de l'application après le chargement du DOM
document.addEventListener('DOMContentLoaded', bootstrap);