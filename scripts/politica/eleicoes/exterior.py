"""Cidade (ou país) do exterior no arquivo do TSE -> país, para somar os votos por país.
O TSE grava, para os votos do exterior (UF "ZZ"), o nome da cidade onde fica a seção (em anos antigos, às vezes o
nome do país ou "CIDADE-PAÍS" abreviado). Esta tabela só diz em que país fica cada nome. Nome sem país conhecido -> None."""
import unicodedata

SUFIXO = {"EUA": "Estados Unidos", "PARG": "Paraguai", "GREC": "Grécia", "ESPA": "Espanha", "LBAN": "Líbano", "RFA": "Alemanha",
          "COLO": "Colômbia", "ARGT": "Argentina", "BELG": "Bélgica", "GUIF": "Guiana Francesa", "CANA": "Canadá", "VENE": "Venezuela",
          "DINA": "Dinamarca", "SUEC": "Suécia", "SUIC": "Suíça", "JAPA": "Japão", "CUBA": "Cuba", "PERU": "Peru", "PORT": "Portugal",
          "GBRE": "Reino Unido", "MOCA": "Moçambique", "ITAL": "Itália", "URUG": "Uruguai", "MEXI": "México", "NORG": "Noruega",
          "PAN": "Panamá", "PANA": "Panamá", "FRAN": "França", "PALE": "Palestina", "HOLA": "Países Baixos", "CHIL": "Chile",
          "BOLI": "Bolívia", "AUST": "Austrália", "RICA": "Costa Rica", "OSTE": "Áustria", "EQUA": "Equador", "SURI": "Suriname",
          "COTE": "Costa do Marfim", "EAU": "Emirados Árabes Unidos", "GANA": "Gana", "JORD": "Jordânia", "TURQ": "Turquia",
          "ARGL": "Argélia", "TAIL": "Tailândia", "SERV": "Sérvia", "GUIB": "Guiné-Bissau", "CONG": "Congo", "ROME": "Romênia",
          "HUNG": "Hungria", "EGIT": "Egito", "RAFS": "África do Sul", "CING": "Singapura", "SING": "Singapura", "SENE": "Senegal",
          "SIRI": "Síria", "TIML": "Timor-Leste", "CATA": "Catar", "CHIN": "China", "IRLS": "Irlanda", "GUIA": "Guiana",
          "GUAT": "Guatemala", "FINL": "Finlândia", "HONG": "China (Hong Kong)", "INDO": "Indonésia", "JAMA": "Jamaica",
          "JAMAICA": "Jamaica", "RCON": "República Democrática do Congo", "KUAI": "Kuwait", "MALA": "Malásia", "NIGR": "Nigéria",
          "GABA": "Gabão", "FILI": "Filipinas", "NICA": "Nicarágua", "RUSS": "Rússia", "QUEN": "Quênia", "INDI": "Índia",
          "NZEL": "Nova Zelândia", "TCHE": "República Tcheca", "CABO": "Cabo Verde", "MARR": "Marrocos", "RDOM": "República Dominicana",
          "ARAB": "Arábia Saudita", "CORS": "Coreia do Sul", "ELSA": "El Salvador", "TAIW": "Taiwan", "HOND": "Honduras",
          "ISRA": "Israel", "TUNI": "Tunísia", "POLO": "Polônia"}

CID = {
 # Américas
 "ARTIGAS": "Uruguai", "ASSUNCAO": "Paraguai", "ATLANTA": "Estados Unidos", "BOSTON": "Estados Unidos", "CHICAGO": "Estados Unidos",
 "HARTFORD": "Estados Unidos", "HOUSTON": "Estados Unidos", "LOS ANGELES": "Estados Unidos", "MIAMI": "Estados Unidos",
 "NOVA YORK": "Estados Unidos", "SAO FRANCISCO": "Estados Unidos", "WASHINGTON": "Estados Unidos", "ORLANDO": "Estados Unidos",
 "BELMOPAN": "Belize", "BOGOTA": "Colômbia", "BRIDGETOWN": "Barbados", "BUENOS AIRES": "Argentina", "CAIENA": "Guiana Francesa",
 "CARACAS": "Venezuela", "CASTRIES": "Santa Lúcia", "CHUY": "Uruguai", "CIUDAD DEL ESTE": "Paraguai", "CIUDAD GUAYANA": "Venezuela",
 "COBIJA": "Bolívia", "COCHABAMBA": "Bolívia", "CONCEPCION": "Paraguai", "CORDOBA": "Argentina", "ENCARNACION": "Paraguai",
 "GEORGETOWN": "Guiana", "GUATEMALA": "Guatemala", "HAVANA": "Cuba", "IQUITOS": "Peru", "LA PAZ": "Bolívia", "LIMA": "Peru",
 "MANAGUA": "Nicarágua", "MENDOZA": "Argentina", "MENDONZA": "Argentina", "MEXICO": "México", "MONTEVIDEU": "Uruguai",
 "MONTREAL": "Canadá", "OTTAWA": "Canadá", "TORONTO": "Canadá", "VANCOUVER": "Canadá", "NASSAU": "Bahamas", "PANAMA": "Panamá",
 "PARAMARIBO": "Suriname", "PASO LOS LIBRES": "Argentina", "PEDRO JUAN CABALLERO": "Paraguai", "PEDRO CABALLERO": "Paraguai",
 "PORT OF SPAIN": "Trinidad e Tobago", "PORTO PRINCIPE": "Haiti", "PORTO RICO": "Porto Rico (EUA)", "PUERTO IGUAZU": "Argentina",
 "PUERTO QUIJARRO": "Bolívia", "QUITO": "Equador", "RIO BRANCO": "Uruguai", "RIVERA": "Uruguai", "SAINT JOHNS": "Antígua e Barbuda",
 "SALTO DEL GUAIRA": "Paraguai", "SALTOS DO GUAIRA": "Paraguai", "SANTA CRUZ DE LA SIERRA": "Bolívia", "STA C LA SIERRA": "Bolívia",
 "SANTA ELENA DE UAIREN": "Venezuela", "SANTIAGO": "Chile", "SAO DOMINGOS": "República Dominicana", "SAO JOSE": "Costa Rica",
 "SAO SALVADOR": "El Salvador", "ST GEORGES DE LOYAPOCK": "Guiana Francesa", "TEGUCIGALPA": "Honduras", "KINGSTON": "Jamaica",
 # Europa
 "AMSTERDA": "Países Baixos", "ROTERDA": "Países Baixos", "ROTTERDA": "Países Baixos", "ATENAS": "Grécia", "BARCELONA": "Espanha",
 "MADRI": "Espanha", "BELGRADO": "Sérvia", "BERLIM": "Alemanha", "FRANKFURT": "Alemanha", "MUNIQUE": "Alemanha",
 "BRATISLAVA": "Eslováquia", "BRUXELAS": "Bélgica", "BUCARESTE": "Romênia", "BUDAPESTE": "Hungria", "COPENHAGUE": "Dinamarca",
 "DUBLIN": "Irlanda", "EDIMBURGO": "Reino Unido", "LONDRES": "Reino Unido", "ESTOCOLMO": "Suécia", "FARO": "Portugal",
 "LISBOA": "Portugal", "PORTO": "Portugal", "GENEBRA": "Suíça", "ZURIQUE": "Suíça", "HELSINQUE": "Finlândia", "KIEV": "Ucrânia",
 "LIUBLIANA": "Eslovênia", "MARSELHA": "França", "PARIS": "França", "MILAO": "Itália", "ROMA": "Itália", "MOSCOU": "Rússia",
 "NICOSIA": "Chipre", "OSLO": "Noruega", "PRAGA": "República Tcheca", "SARAJEVO": "Bósnia e Herzegovina", "SOFIA": "Bulgária",
 "TALIN": "Estônia", "TIRANA": "Albânia", "VARSOVIA": "Polônia", "VATICANO": "Vaticano", "VIENA": "Áustria", "ZAGREB": "Croácia",
 "ISTAMBUL": "Turquia", "ANCARA": "Turquia",
 # Ásia e Oceania
 "ABU DHABI": "Emirados Árabes Unidos", "AMA": "Jordânia", "ASTANA": "Cazaquistão", "BAGDA": "Iraque", "BAKU": "Azerbaijão",
 "BANGKOK": "Tailândia", "BAREIN": "Bahrein", "BEIRUTE": "Líbano", "CAMBERRA": "Austrália", "SYDNEY": "Austrália",
 "CANTAO": "China", "DONGGUAN": "China", "PEQUIM": "China", "XANGAI": "China", "HONG KONG": "China (Hong Kong)",
 "CINGAPURA": "Singapura", "SINGAPURA": "Singapura", "COLOMBO": "Sri Lanka", "DACCA": "Bangladesh", "DAMASCO": "Síria",
 "DILI": "Timor-Leste", "DOHA": "Catar", "HANOI": "Vietnã", "IEREVAN": "Armênia", "ISLAMABADE": "Paquistão", "JACARTA": "Indonésia",
 "KATMANDU": "Nepal", "KUAITE": "Kuwait", "KUALA LUMPUR": "Malásia", "MANILA": "Filipinas", "MASCATE": "Omã", "MUMBAI": "Índia",
 "NOVA DELHI": "Índia", "PYONGYANG": "Coreia do Norte", "RAMALLAH": "Palestina", "RIADE": "Arábia Saudita", "SEUL": "Coreia do Sul",
 "TAIPE": "Taiwan", "TBILISI": "Geórgia", "TEERA": "Irã", "TEL AVIV": "Israel", "YANGON": "Mianmar", "WELLINGTON": "Nova Zelândia",
 "HAMAMATSU": "Japão", "NAGOIA": "Japão", "NAGOYA": "Japão", "OIZUMI": "Japão", "SUZUKA": "Japão", "TOQUIO": "Japão",
 "TOYOHASHI": "Japão", "UEDA": "Japão", "MITSUKAIDO": "Japão", "TAKAOKA": "Japão",
 # África
 "ABIDJA": "Costa do Marfim", "ABIDJAN": "Costa do Marfim", "ABUJA": "Nigéria", "LAGOS": "Nigéria", "ACCRA": "Gana",
 "ADIS ABEBA": "Etiópia", "ARGEL": "Argélia", "BAMAKO": "Mali", "BISSAU": "Guiné-Bissau", "BRAZZAVILLE": "Congo",
 "CAIRO": "Egito", "CIDADE DO CABO": "África do Sul", "PRETORIA": "África do Sul", "CONACRI": "Guiné", "COTONOU": "Benin",
 "DACAR": "Senegal", "DAR ES SALAAM": "Tanzânia", "GABORONE": "Botsuana", "HARARE": "Zimbábue", "IAUNDE": "Camarões",
 "KINSHASA": "República Democrática do Congo", "LIBREVILLE": "Gabão", "LILONGUE": "Malawi", "LOME": "Togo", "LUANDA": "Angola",
 "LUSACA": "Zâmbia", "MALABO": "Guiné Equatorial", "MAPUTO": "Moçambique", "NAIROBI": "Quênia", "PRAIA": "Cabo Verde",
 "RABAT": "Marrocos", "SAO TOME": "São Tomé e Príncipe", "TRIPOLI": "Líbia", "TUNIS": "Tunísia", "UAGADUGU": "Burkina Faso",
 "WINDHOEK": "Namíbia",
}

# Anos antigos: o "município" é o próprio país
PAIS = {"AFRICA DO SUL": "África do Sul", "ALEMANHA": "Alemanha", "ANGOLA": "Angola", "ARABIA SAUDITA": "Arábia Saudita",
        "ARGENTINA": "Argentina", "AUSTRALIA": "Austrália", "AUSTRIA": "Áustria", "BELGICA": "Bélgica", "BOLIVIA": "Bolívia",
        "CABO VERDE": "Cabo Verde", "CANADA": "Canadá", "CHECOSLOVAQUIA": "Tchecoslováquia", "CHILE": "Chile", "CHINA": "China",
        "COLOMBIA": "Colômbia", "COREIA": "Coreia", "COSTA DO MARFIM": "Costa do Marfim", "COSTA RICA": "Costa Rica", "CUBA": "Cuba",
        "DINAMARCA": "Dinamarca", "EGITO": "Egito", "EL SALVADOR": "El Salvador", "EMIRADOS ARABES": "Emirados Árabes Unidos",
        "EQUADOR": "Equador", "ESPANHA": "Espanha", "ESTADOS UNIDOS": "Estados Unidos", "FILIPINAS": "Filipinas", "FINLANDIA": "Finlândia",
        "FRANCA": "França", "GABAO": "Gabão", "GANA": "Gana", "GRECIA": "Grécia", "GUIANA": "Guiana", "GUIANA FRANCESA": "Guiana Francesa",
        "GUINE BISSAU": "Guiné-Bissau", "HAITI": "Haiti", "HONDURAS": "Honduras", "HUNGRIA": "Hungria", "INDIA": "Índia",
        "INDONESIA": "Indonésia", "INGLATERRA": "Reino Unido", "IRLANDA": "Irlanda", "ISRAEL": "Israel", "ITALIA": "Itália",
        "JAPAO": "Japão", "JORDANIA": "Jordânia", "KENIA": "Quênia", "KUWAIT": "Kuwait", "LIBANO": "Líbano", "MALASIA": "Malásia",
        "MARROCOS": "Marrocos", "MOCAMBIQUE": "Moçambique", "NICARAGUA": "Nicarágua", "NIGERIA": "Nigéria", "NORUEGA": "Noruega",
        "NOVA ZELANDIA": "Nova Zelândia", "PAISES BAIXOS": "Países Baixos", "PARAGUAI": "Paraguai", "PERU": "Peru", "POLONIA": "Polônia",
        "PORTUGAL": "Portugal", "REPUBLICA DOMINICANA": "República Dominicana", "ROMENIA": "Romênia", "RUSSIA": "Rússia",
        "SENEGAL": "Senegal", "SIRIA": "Síria", "SUECIA": "Suécia", "SUICA": "Suíça", "SURINAME": "Suriname", "TAILANDIA": "Tailândia",
        "TAIWAN": "Taiwan", "TUNISIA": "Tunísia", "TURQUIA": "Turquia", "URUGUAI": "Uruguai", "VENEZUELA": "Venezuela"}


def _n(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper().strip()


def pais(nome):
    """Devolve (cidade, país). cidade = "" quando o próprio arquivo só traz o país."""
    n = _n(nome)
    if n in PAIS:
        return "", PAIS[n]
    cid = n
    if "-" in n:
        cid, suf = n.rsplit("-", 1)
        if suf.strip() in SUFIXO:
            return cid.strip(), SUFIXO[suf.strip()]
    if cid in CID:
        return cid, CID[cid]
    return cid, None
