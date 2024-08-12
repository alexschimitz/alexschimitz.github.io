const NUM_POKEMON = 151;
const Pokedex = [
    { nome: "Bulbasaur", tipo: "Grama", indice_original: 1 },
    { nome: "Ivysaur", tipo: "Grama", indice_original: 2 },
    { nome: "Venusaur", tipo: "Grama", indice_original: 3 },
    { nome: "Charmander", tipo: "Fogo", indice_original: 4 },
    { nome: "Charmeleon", tipo: "Fogo", indice_original: 5 },
    { nome: "Charizard", tipo: "Fogo/Voador", indice_original: 6 },
    { nome: "Squirtle", tipo: "Agua", indice_original: 7 },
    { nome: "Wartortle", tipo: "Agua", indice_original: 8 },
    { nome: "Blastoise", tipo: "Agua", indice_original: 9 },
    { nome: "Caterpie", tipo: "Inseto", indice_original: 10 },
    { nome: "Metapod", tipo: "Inseto", indice_original: 11 },
    { nome: "Butterfree", tipo: "Inseto/Voador", indice_original: 12 },
    { nome: "Weedle", tipo: "Inseto/Veneno", indice_original: 13 },
    { nome: "Kakuna", tipo: "Inseto/Veneno", indice_original: 14 },
    { nome: "Beedrill", tipo: "Inseto/Veneno", indice_original: 15 },
    { nome: "Pidgey", tipo: "Normal/Voador", indice_original: 16 },
    { nome: "Pidgeotto", tipo: "Normal/Voador", indice_original: 17 },
    { nome: "Pidgeot", tipo: "Normal/Voador", indice_original: 18 },
    { nome: "Rattata", tipo: "Normal", indice_original: 19 },
    { nome: "Raticate", tipo: "Normal", indice_original: 20 },
    { nome: "Spearow", tipo: "Normal/Voador", indice_original: 21 },
    { nome: "Fearow", tipo: "Normal/Voador", indice_original: 22 },
    { nome: "Ekans", tipo: "Veneno", indice_original: 23 },
    { nome: "Arbok", tipo: "Veneno", indice_original: 24 },
    { nome: "Pikachu", tipo: "Eletrico", indice_original: 25 },
    { nome: "Raichu", tipo: "Eletrico", indice_original: 26 },
    { nome: "Sandshrew", tipo: "Terra", indice_original: 27 },
    { nome: "Sandslash", tipo: "Terra", indice_original: 28 },
    { nome: "Nidoran♀", tipo: "Veneno", indice_original: 29 },
    { nome: "Nidorina", tipo: "Veneno", indice_original: 30 },
    { nome: "Nidoqueen", tipo: "Veneno/Terra", indice_original: 31 },
    { nome: "Nidoran♂", tipo: "Veneno", indice_original: 32 },
    { nome: "Nidorino", tipo: "Veneno", indice_original: 33 },
    { nome: "Nidoking", tipo: "Veneno/Terra", indice_original: 34 },
    { nome: "Clefairy", tipo: "Fada", indice_original: 35 },
    { nome: "Clefable", tipo: "Fada", indice_original: 36 },
    { nome: "Vulpix", tipo: "Fogo", indice_original: 37 },
    { nome: "Ninetales", tipo: "Fogo", indice_original: 38 },
    { nome: "Jigglypuff", tipo: "Normal/Fada", indice_original: 39 },
    { nome: "Wigglytuff", tipo: "Normal/Fada", indice_original: 40 },
    { nome: "Zubat", tipo: "Veneno/Voador", indice_original: 41 },
    { nome: "Golbat", tipo: "Veneno/Voador", indice_original: 42 },
    { nome: "Oddish", tipo: "Grama/Veneno", indice_original: 43 },
    { nome: "Gloom", tipo: "Grama/Veneno", indice_original: 44 },
    { nome: "Vileplume", tipo: "Grama/Veneno", indice_original: 45 },
    { nome: "Paras", tipo: "Inseto/Grama", indice_original: 46 },
    { nome: "Parasect", tipo: "Inseto/Grama", indice_original: 47 },
    { nome: "Venonat", tipo: "Inseto/Veneno", indice_original: 48 },
    { nome: "Venomoth", tipo: "Inseto/Veneno", indice_original: 49 },
    { nome: "Diglett", tipo: "Terra", indice_original: 50 },
    { nome: "Dugtrio", tipo: "Terra", indice_original: 51 },
    { nome: "Meowth", tipo: "Normal", indice_original: 52 },
    { nome: "Persian", tipo: "Normal", indice_original: 53 },
    { nome: "Psyduck", tipo: "Agua", indice_original: 54 },
    { nome: "Golduck", tipo: "Agua", indice_original: 55 },
    { nome: "Mankey", tipo: "Lutador", indice_original: 56 },
    { nome: "Primeape", tipo: "Lutador", indice_original: 57 },
    { nome: "Growlithe", tipo: "Fogo", indice_original: 58 },
    { nome: "Arcanine", tipo: "Fogo", indice_original: 59 },
    { nome: "Poliwag", tipo: "Agua", indice_original: 60 },
    { nome: "Poliwhirl", tipo: "Agua", indice_original: 61 },
    { nome: "Poliwrath", tipo: "Agua/Lutador", indice_original: 62 },
    { nome: "Abra", tipo: "Psiquico", indice_original: 63 },
    { nome: "Kadabra", tipo: "Psiquico", indice_original: 64 },
    { nome: "Alakazam", tipo: "Psiquico", indice_original: 65 },
    { nome: "Machop", tipo: "Lutador", indice_original: 66 },
    { nome: "Machoke", tipo: "Lutador", indice_original: 67 },
    { nome: "Machamp", tipo: "Lutador", indice_original: 68 },
    { nome: "Bellsprout", tipo: "Grama/Veneno", indice_original: 69 },
    { nome: "Weepinbell", tipo: "Grama/Veneno", indice_original: 70 },
    { nome: "Victreebel", tipo: "Grama/Veneno", indice_original: 71 },
    { nome: "Tentacool", tipo: "Agua/Veneno", indice_original: 72 },
    { nome: "Tentacruel", tipo: "Agua/Veneno", indice_original: 73 },
    { nome: "Geodude", tipo: "Pedra/Terra", indice_original: 74 },
    { nome: "Graveler", tipo: "Pedra/Terra", indice_original: 75 },
    { nome: "Golem", tipo: "Pedra/Terra", indice_original: 76 },
    { nome: "Ponyta", tipo: "Fogo", indice_original: 77 },
    { nome: "Rapidash", tipo: "Fogo", indice_original: 78 },
    { nome: "Slowpoke", tipo: "Agua/Psiquico", indice_original: 79 },
    { nome: "Slowbro", tipo: "Agua/Psiquico", indice_original: 80 },
    { nome: "Magnemite", tipo: "Eletrico/Metálico", indice_original: 81 },
    { nome: "Magneton", tipo: "Eletrico/Metálico", indice_original: 82 },
    { nome: "Farfetch'd", tipo: "Normal/Voador", indice_original: 83 },
    { nome: "Doduo", tipo: "Normal/Voador", indice_original: 84 },
    { nome: "Dodrio", tipo: "Normal/Voador", indice_original: 85 },
    { nome: "Seel", tipo: "Agua", indice_original: 86 },
    { nome: "Dewgong", tipo: "Agua/Gelo", indice_original: 87 },
    { nome: "Grimer", tipo: "Veneno", indice_original: 88 },
    { nome: "Muk", tipo: "Veneno", indice_original: 89 },
    { nome: "Shellder", tipo: "Agua", indice_original: 90 },
    { nome: "Cloyster", tipo: "Agua/Gelo", indice_original: 91 },
    { nome: "Gastly", tipo: "Fantasma/Veneno", indice_original: 92 },
    { nome: "Haunter", tipo: "Fantasma/Veneno", indice_original: 93 },
    { nome: "Gengar", tipo: "Fantasma/Veneno", indice_original: 94 },
    { nome: "Onix", tipo: "Pedra/Terra", indice_original: 95 },
    { nome: "Drowzee", tipo: "Psiquico", indice_original: 96 },
    { nome: "Hypno", tipo: "Psiquico", indice_original: 97 },
    { nome: "Krabby", tipo: "Agua", indice_original: 98 },
    { nome: "Kingler", tipo: "Agua", indice_original: 99 },
    { nome: "Voltorb", tipo: "Eletrico", indice_original: 100 },
    { nome: "Electrode", tipo: "Eletrico", indice_original: 101 },
    { nome: "Exeggcute", tipo: "Grama/Psiquico", indice_original: 102 },
    { nome: "Exeggutor", tipo: "Grama/Psiquico", indice_original: 103 },
    { nome: "Cubone", tipo: "Terra", indice_original: 104 },
    { nome: "Marowak", tipo: "Terra", indice_original: 105 },
    { nome: "Hitmonlee", tipo: "Lutador", indice_original: 106 },
    { nome: "Hitmonchan", tipo: "Lutador", indice_original: 107 },
    { nome: "Lickitung", tipo: "Normal", indice_original: 108 },
    { nome: "Koffing", tipo: "Veneno", indice_original: 109 },
    { nome: "Weezing", tipo: "Veneno", indice_original: 110 },
    { nome: "Rhyhorn", tipo: "Terra/Pedra", indice_original: 111 },
    { nome: "Rhydon", tipo: "Terra/Pedra", indice_original: 112 },
    { nome: "Chansey", tipo: "Normal", indice_original: 113 },
    { nome: "Tangela", tipo: "Grama", indice_original: 114 },
    { nome: "Kangaskhan", tipo: "Normal", indice_original: 115 },
    { nome: "Horsea", tipo: "Agua", indice_original: 116 },
    { nome: "Seadra", tipo: "Agua", indice_original: 117 },
    { nome: "Goldeen", tipo: "Agua", indice_original: 118 },
    { nome: "Seaking", tipo: "Agua", indice_original: 119 },
    { nome: "Staryu", tipo: "Agua", indice_original: 120 },
    { nome: "Starmie", tipo: "Agua/Psiquico", indice_original: 121 },
    { nome: "Mr. Mime", tipo: "Psiquico/Fada", indice_original: 122 },
    { nome: "Scyther", tipo: "Inseto/Voador", indice_original: 123 },
    { nome: "Jynx", tipo: "Gelo/Psiquico", indice_original: 124 },
    { nome: "Electabuzz", tipo: "Eletrico", indice_original: 125 },
    { nome: "Magmar", tipo: "Fogo", indice_original: 126 },
    { nome: "Pinsir", tipo: "Inseto", indice_original: 127 },
    { nome: "Tauros", tipo: "Normal", indice_original: 128 },
    { nome: "Magikarp", tipo: "Agua", indice_original: 129 },
    { nome: "Gyarados", tipo: "Agua/Voador", indice_original: 130 },
    { nome: "Lapras", tipo: "Agua/Gelo", indice_original: 131 },
    { nome: "Ditto", tipo: "Normal", indice_original: 132 },
    { nome: "Eevee", tipo: "Normal", indice_original: 133 },
    { nome: "Vaporeon", tipo: "Agua", indice_original: 134 },
    { nome: "Jolteon", tipo: "Eletrico", indice_original: 135 },
    { nome: "Flareon", tipo: "Fogo", indice_original: 136 },
    { nome: "Porygon", tipo: "Normal", indice_original: 137 },
    { nome: "Omanyte", tipo: "Pedra/Agua", indice_original: 138 },
    { nome: "Omastar", tipo: "Pedra/Agua", indice_original: 139 },
    { nome: "Kabuto", tipo: "Pedra/Agua", indice_original: 140 },
    { nome: "Kabutops", tipo: "Pedra/Agua", indice_original: 141 },
    { nome: "Aerodactyl", tipo: "Pedra/Voador", indice_original: 142 },
    { nome: "Snorlax", tipo: "Normal", indice_original: 143 },
    { nome: "Articuno", tipo: "Gelo/Voador", indice_original: 144 },
    { nome: "Zapdos", tipo: "Eletrico/Voador", indice_original: 145 },
    { nome: "Moltres", tipo: "Fogo/Voador", indice_original: 146 },
    { nome: "Dratini", tipo: "Dragão", indice_original: 147 },
    { nome: "Dragonair", tipo: "Dragão", indice_original: 148 },
    { nome: "Dragonite", tipo: "Dragão/Voador", indice_original: 149 },
    { nome: "Mewtwo", tipo: "Psiquico", indice_original: 150 },
    { nome: "Mew", tipo: "Psiquico", indice_original: 151 }
];

let currentIndex = 0;

function toLowerCase(str) {
    return str.toLowerCase();
}

function displayPokemon(index) {
    const resultDiv = document.getElementById('result');
    const pokemon = Pokedex[index];
    const imagePath = `./imagens/Pokemon/${pokemon.nome}.png`;

    resultDiv.innerHTML = `
        <p>Pokémon encontrado: ${pokemon.nome}, Tipo: ${pokemon.tipo}, Índice Original: ${pokemon.indice_original}</p>
        <img src="${imagePath}" alt="${pokemon.nome}" style="max-width: 100px; max-height: 100px; position: relative; top: -50px; left: -20px;">
    `;
}

function searchPokemon() {
    const query = document.getElementById('searchInput').value.trim();
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = ''; // Limpar resultados anteriores

    if (!isNaN(query)) {
        const numero = parseInt(query, 10);
        if (numero > 0 && numero <= NUM_POKEMON) {
            currentIndex = numero - 1;
            displayPokemon(currentIndex);
        } else {
            resultDiv.innerHTML = 'Número de Pokémon inválido.';
        }
    } else {
        const queryLower = toLowerCase(query);
        let encontrado = false;

        Pokedex.forEach((pokemon, index) => {
            const nomeLower = toLowerCase(pokemon.nome);
            if (nomeLower.includes(queryLower)) {
                currentIndex = index;
                displayPokemon(currentIndex);
                encontrado = true;
            }
        });

        if (!encontrado) {
            resultDiv.innerHTML = 'Nenhum Pokémon encontrado.';
        }
    }
}

function handleEnter(event) {
    if (event.key === 'Enter') {
        searchPokemon();
    }
}

function previousPokemon() {
    if (currentIndex > 0) {
        currentIndex--;
        displayPokemon(currentIndex);
    }
}

function nextPokemon() {
    if (currentIndex < NUM_POKEMON - 1) {
        currentIndex++;
        displayPokemon(currentIndex);
    }
}