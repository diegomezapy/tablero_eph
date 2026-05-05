"""
preprocess.py - EPHC Dashboard Data Pipeline
Reads REG01 (household) and REG02 (person) data for 2022-2025,
computes weighted statistics, and outputs JSON files for the dashboard.
"""

import pandas as pd
import numpy as np
import pyreadstat
import json
from pathlib import Path

# --- Configuration ---
YEARS = [2022, 2023, 2024, 2025]
BASE_DIR = Path("H:/Mi unidad/EPHn")
OUTPUT_DIR = Path(__file__).parent.parent / "data"

REG02_PATHS = {
    y: BASE_DIR / f"REG02_EPHC_ANUAL_{y}.csv" for y in YEARS
}

REG01_PATHS = {
    2022: (BASE_DIR / "REG01_EPHC_ANUAL_2022.csv", "csv"),
    2023: (BASE_DIR / "REG01_EPHC_ANUAL_2023.csv", "csv"),
    2024: (BASE_DIR / "REG01_EPHC_ANUAL_2024.csv", "csv"),
    2025: (BASE_DIR / "REG01_EPHC_ANUAL_2025.csv", "csv"),
}

DPTO_LABELS = {
    0: "Asunción", 1: "Concepción", 2: "San Pedro", 3: "Cordillera",
    4: "Guairá", 5: "Caaguazú", 6: "Caazapá", 7: "Itapúa",
    8: "Misiones", 9: "Paraguarí", 10: "Alto Paraná", 11: "Central",
    12: "Ñeembucú", 13: "Amambay", 14: "Canindeyú", 15: "Pte. Hayes",
    16: "Boquerón", 17: "Alto Paraguay", 18: "Capital", 19: "Resto"
}

AGE_BINS = [-1, 14, 24, 34, 44, 54, 64, 200]
AGE_LABELS = ["0-14", "15-24", "25-34", "35-44", "45-54", "55-64", "65+"]

DIMENSIONS = {
    'dpto':     {'col': 'DPTO',      'values': None},  # filled dynamically
    'area':     {'col': 'AREA',      'values': [1, 6]},
    'sex':      {'col': 'P06',       'values': [1, 6]},
    'age_group':{'col': 'age_group', 'values': AGE_LABELS},
    'poverty':  {'col': 'pobrezai',  'values': [1, 2, 3]},
    'condact':  {'col': 'condact',   'values': [1, 2, 3]},
    'cate_pea': {'col': 'CATE_PEA',  'values': [1, 2, 3, 4, 5, 6]},
    'rama_pea': {'col': 'RAMA_PEA',  'values': [1, 2, 3, 4, 5, 6, 7, 8]},
}

# All pairs MUST be in alphabetical order (a-z) so keys match the JS buildKey() sort
CROSS_TABS_2D = [
    ('age_group', 'area'),
    ('age_group', 'cate_pea'),
    ('age_group', 'condact'),
    ('age_group', 'rama_pea'),
    ('age_group', 'sex'),
    ('area', 'cate_pea'),
    ('area', 'condact'),
    ('area', 'dpto'),
    ('area', 'poverty'),
    ('area', 'rama_pea'),
    ('area', 'sex'),
    ('cate_pea', 'sex'),
    ('condact', 'dpto'),
    ('condact', 'poverty'),
    ('condact', 'sex'),
    ('dpto', 'sex'),
    ('poverty', 'sex'),
    ('rama_pea', 'sex'),
]

# REG01 only has these dimensions
DIMS_REG01 = {
    'dpto':    {'col': 'DPTO',     'values': None},
    'area':    {'col': 'AREA',     'values': [1, 6]},
    'poverty': {'col': 'POBREZAI', 'values': [1, 2, 3]},
}
CROSS_TABS_REG01 = [('dpto', 'area'), ('area', 'poverty')]


# ============================================================
# Loading Functions
# ============================================================

def fix_numeric(series):
    if series.dtype == object:
        return pd.to_numeric(series.astype(str).str.replace(',', '.').str.strip(), errors='coerce')
    return pd.to_numeric(series, errors='coerce')


def load_reg02(year):
    print(f"  Loading REG02 {year}...")
    df = pd.read_csv(REG02_PATHS[year], sep=';', encoding='utf-8-sig', low_memory=False)

    # Normalize weight column
    weight_col = [c for c in df.columns if 'FEX' in c.upper() or c == 'FACTOR']
    if weight_col:
        df.rename(columns={weight_col[0]: 'FACTOR'}, inplace=True)

    # Fix comma decimals for key numeric columns
    for col in ['FACTOR', 'ipcm', 'añoest']:
        if col in df.columns:
            df[col] = fix_numeric(df[col])

    # Ensure key columns are numeric
    for col in ['P02', 'P06', 'DPTO', 'AREA', 'pobrezai', 'pobnopoi',
                'CATE_PEA', 'OCUP_PEA', 'RAMA_PEA', 'informalidad',
                'quintili', 'decili', 'ED01', 'ED02', 'PEAA', 'PEAD', 'P03']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    # Derived columns
    df['age_group'] = pd.cut(df['P02'], bins=AGE_BINS, labels=AGE_LABELS)
    df['year'] = year

    # condact: economic activity status (10+ only)
    # PEAA: 1=Ocupado, 2=Desocupado, 3=Inactivo, 9/NaN=N/A
    if 'PEAA' in df.columns:
        df['condact'] = df['PEAA'].map({1.0: 1, 2.0: 2, 3.0: 3})
    else:
        df['condact'] = np.nan

    print(f"    {len(df)} rows, weight col: FACTOR, mean={df['FACTOR'].mean():.1f}")
    return df


def load_reg01(year):
    path, fmt = REG01_PATHS[year]
    print(f"  Loading REG01 {year} ({fmt})...")

    if fmt == 'sav':
        df, meta = pyreadstat.read_sav(str(path))
        df.columns = df.columns.str.upper()
    else:
        df = pd.read_csv(path, sep=';', encoding='utf-8-sig', low_memory=False)
        df.columns = df.columns.str.upper()

    # Normalize weight
    weight_col = [c for c in df.columns if 'FEX' in c.upper() or c == 'FACTOR']
    if weight_col:
        df.rename(columns={weight_col[0]: 'FACTOR'}, inplace=True)

    if 'FACTOR' in df.columns:
        df['FACTOR'] = fix_numeric(df['FACTOR'])

    for col in ['DPTO', 'AREA', 'POBREZAI', 'POBNOPOI', 'TOTAL', 'V01', 'V02A', 'V02B',
                'V03', 'V04', 'V05', 'V06', 'V07', 'V08', 'V10', 'V12', 'V13',
                'V14B', 'V15', 'V23B']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    df['year'] = year
    print(f"    {len(df)} rows")
    return df


# ============================================================
# Aggregation Engine
# ============================================================

def weighted_pct(df, mask, weight='FACTOR'):
    valid = df[weight].notna()
    sub = df[valid]
    m = mask[valid]
    denom = sub[weight].sum()
    if denom == 0:
        return None
    return round(100.0 * sub.loc[m, weight].sum() / denom, 2)


def weighted_mean(df, col, weight='FACTOR'):
    valid = df[[col, weight]].dropna()
    if len(valid) == 0:
        return None
    denom = valid[weight].sum()
    if denom == 0:
        return None
    return round((valid[col] * valid[weight]).sum() / denom, 2)


def weighted_median(df, col, weight='FACTOR'):
    valid = df[[col, weight]].dropna()
    if len(valid) == 0:
        return None
    sorted_df = valid.sort_values(col)
    cumw = sorted_df[weight].cumsum()
    total = sorted_df[weight].sum()
    if total == 0:
        return None
    idx = (cumw >= total / 2).idxmax()
    return round(float(sorted_df.loc[idx, col]), 2)


def aggregate(df_all, compute_fn, dims_config, cross_tabs, weight='FACTOR', min_n=30):
    result = {}

    # National by year
    result["year"] = {}
    for y in YEARS:
        sub = df_all[df_all['year'] == y]
        if len(sub) >= min_n:
            val = compute_fn(sub)
            result["year"][str(y)] = {"v": val, "n": int(len(sub))}

    # 1D marginals
    for dim_name, dim_info in dims_config.items():
        key = f"year|{dim_name}"
        result[key] = {}
        col = dim_info['col']
        values = dim_info['values']
        if values is None:
            values = sorted(df_all[col].dropna().unique())
        for y in YEARS:
            for dv in values:
                sub = df_all[(df_all['year'] == y) & (df_all[col] == dv)]
                if len(sub) >= min_n:
                    val = compute_fn(sub)
                    result[key][f"{y}|{dv}"] = {"v": val, "n": int(len(sub))}

    # 2D cross-tabs
    for d1_name, d2_name in cross_tabs:
        d1 = dims_config[d1_name]
        d2 = dims_config[d2_name]
        key = f"year|{d1_name}|{d2_name}"
        result[key] = {}
        v1s = d1['values'] if d1['values'] is not None else sorted(df_all[d1['col']].dropna().unique())
        v2s = d2['values'] if d2['values'] is not None else sorted(df_all[d2['col']].dropna().unique())
        for y in YEARS:
            for v1 in v1s:
                for v2 in v2s:
                    sub = df_all[(df_all['year'] == y) & (df_all[d1['col']] == v1) & (df_all[d2['col']] == v2)]
                    if len(sub) >= min_n:
                        val = compute_fn(sub)
                        result[key][f"{y}|{v1}|{v2}"] = {"v": val, "n": int(len(sub))}

    return result


# ============================================================
# Indicator Computation Functions
# ============================================================

def compute_poverty(reg02):
    print("  Computing poverty indicators...")
    indicators = {}

    indicators['poverty_rate'] = {
        'label': 'Tasa de pobreza total', 'unit': '%',
        'data': aggregate(reg02, lambda s: weighted_pct(s, s['pobrezai'].isin([1, 2])),
                          DIMENSIONS, CROSS_TABS_2D)
    }
    indicators['extreme_poverty_rate'] = {
        'label': 'Pobreza extrema', 'unit': '%',
        'data': aggregate(reg02, lambda s: weighted_pct(s, s['pobrezai'] == 1),
                          DIMENSIONS, CROSS_TABS_2D)
    }
    indicators['non_extreme_poverty_rate'] = {
        'label': 'Pobreza no extrema', 'unit': '%',
        'data': aggregate(reg02, lambda s: weighted_pct(s, s['pobrezai'] == 2),
                          DIMENSIONS, CROSS_TABS_2D)
    }
    indicators['mean_ipcm'] = {
        'label': 'Ingreso per cápita medio (Gs.)', 'unit': 'Gs.',
        'data': aggregate(reg02, lambda s: weighted_mean(s, 'ipcm'),
                          DIMENSIONS, CROSS_TABS_2D)
    }
    indicators['median_ipcm'] = {
        'label': 'Ingreso per cápita mediano (Gs.)', 'unit': 'Gs.',
        'data': aggregate(reg02, lambda s: weighted_median(s, 'ipcm'),
                          DIMENSIONS, CROSS_TABS_2D)
    }

    return {"indicators": indicators}


def compute_employment(reg02):
    print("  Computing employment indicators...")
    # Working age population (15+)
    wap = reg02[reg02['P02'] >= 15].copy()
    # PEA: those with CATE_PEA not null (employed or unemployed)
    # Occupied: CATE_PEA in 1-6
    # Unemployed: PEAD == 1 or PEAA == 1 indicates economically active

    indicators = {}

    # Activity rate: PEA / WAP
    indicators['activity_rate'] = {
        'label': 'Tasa de actividad', 'unit': '%',
        'data': aggregate(wap, lambda s: weighted_pct(s, s['CATE_PEA'].notna() & (s['CATE_PEA'] > 0)),
                          DIMENSIONS, CROSS_TABS_2D)
    }

    # Employment rate: Occupied / WAP
    indicators['employment_rate'] = {
        'label': 'Tasa de empleo', 'unit': '%',
        'data': aggregate(wap, lambda s: weighted_pct(s, s['CATE_PEA'].isin([1,2,3,4,5,6])),
                          DIMENSIONS, CROSS_TABS_2D)
    }

    # Unemployment rate: among PEA
    pea = wap[wap['CATE_PEA'].notna() & (wap['CATE_PEA'] > 0)].copy()
    indicators['unemployment_rate'] = {
        'label': 'Tasa de desempleo', 'unit': '%',
        'data': aggregate(pea, lambda s: weighted_pct(s, s['CATE_PEA'] == 7) if 7 in s['CATE_PEA'].values
                          else weighted_pct(s, ~s['CATE_PEA'].isin([1,2,3,4,5,6])),
                          DIMENSIONS, CROSS_TABS_2D)
    }

    # Informality rate: among occupied with informality data
    occ = wap[wap['CATE_PEA'].isin([1,2,3,4,5,6])].copy()
    occ_inf = occ[occ['informalidad'].isin([1, 2])].copy()
    indicators['informality_rate'] = {
        'label': 'Tasa de informalidad', 'unit': '%',
        'data': aggregate(occ_inf, lambda s: weighted_pct(s, s['informalidad'] == 2),
                          DIMENSIONS, CROSS_TABS_2D)
    }

    # Category distribution (CATE_PEA)
    for cat_val, cat_label in [(1, 'Empleado/a público'), (2, 'Empleado/a privado'),
                                (3, 'Empleador/a'), (4, 'Cuenta propia'),
                                (5, 'Familiar no remunerado'), (6, 'Empleado/a doméstico')]:
        indicators[f'cate_pea_{cat_val}'] = {
            'label': cat_label, 'unit': '%',
            'data': aggregate(occ, lambda s, cv=cat_val: weighted_pct(s, s['CATE_PEA'] == cv),
                              DIMENSIONS, CROSS_TABS_2D)
        }

    # Industry distribution (RAMA_PEA)
    rama_labels = {1: 'Agricultura', 2: 'Industria', 3: 'Electricidad/agua',
                   4: 'Construcción', 5: 'Comercio/hoteles', 6: 'Transporte/comunicaciones',
                   7: 'Finanzas/seguros', 8: 'Serv. comunales/sociales'}
    for rv, rl in rama_labels.items():
        indicators[f'rama_pea_{rv}'] = {
            'label': rl, 'unit': '%',
            'data': aggregate(occ, lambda s, v=rv: weighted_pct(s, s['RAMA_PEA'] == v),
                              DIMENSIONS, CROSS_TABS_2D)
        }

    return {"indicators": indicators}


def compute_income(reg02):
    print("  Computing income indicators...")
    indicators = {}

    indicators['mean_income'] = {
        'label': 'Ingreso per cápita medio', 'unit': 'Gs.',
        'data': aggregate(reg02, lambda s: weighted_mean(s, 'ipcm'),
                          DIMENSIONS, CROSS_TABS_2D)
    }
    indicators['median_income'] = {
        'label': 'Ingreso per cápita mediano', 'unit': 'Gs.',
        'data': aggregate(reg02, lambda s: weighted_median(s, 'ipcm'),
                          DIMENSIONS, CROSS_TABS_2D)
    }

    # Income by quintile
    for q in range(1, 6):
        qdata = reg02[reg02['quintili'] == q]
        indicators[f'mean_income_q{q}'] = {
            'label': f'Ingreso medio quintil {q}', 'unit': 'Gs.',
            'data': aggregate(qdata, lambda s: weighted_mean(s, 'ipcm'),
                              {'area': DIMENSIONS['area'], 'sex': DIMENSIONS['sex']},
                              [('area', 'sex')])
        }

    # Quintile distribution
    for q in range(1, 6):
        indicators[f'quintile_{q}_pct'] = {
            'label': f'Quintil {q}', 'unit': '%',
            'data': aggregate(reg02, lambda s, qv=q: weighted_pct(s, s['quintili'] == qv),
                              DIMENSIONS, CROSS_TABS_2D)
        }

    # ---- Wage trajectories: mean ipcm by age_group (occupied workers only) ----
    occ = reg02[reg02['CATE_PEA'].isin([1, 2, 3, 4, 5, 6]) & reg02['ipcm'].notna() & (reg02['ipcm'] > 0)].copy()

    WAGE_DIMS = {
        'age_group': DIMENSIONS['age_group'],
        'area':      DIMENSIONS['area'],
        'cate_pea':  DIMENSIONS['cate_pea'],
        'condact':   DIMENSIONS['condact'],
        'dpto':      DIMENSIONS['dpto'],
        'poverty':   DIMENSIONS['poverty'],
        'rama_pea':  DIMENSIONS['rama_pea'],
        'sex':       DIMENSIONS['sex'],
    }
    WAGE_CROSS = [
        ('age_group', 'area'),
        ('age_group', 'cate_pea'),
        ('age_group', 'condact'),
        ('age_group', 'rama_pea'),
        ('age_group', 'sex'),
        ('area', 'cate_pea'),
        ('area', 'condact'),
        ('area', 'dpto'),
        ('area', 'poverty'),
        ('area', 'rama_pea'),
        ('area', 'sex'),
        ('cate_pea', 'sex'),
        ('condact', 'sex'),
        ('dpto', 'sex'),
        ('poverty', 'sex'),
        ('rama_pea', 'sex'),
    ]

    indicators['mean_wage_age'] = {
        'label': 'Ingreso medio por edad (ocupados)', 'unit': 'Gs.',
        'data': aggregate(occ, lambda s: weighted_mean(s, 'ipcm'),
                          WAGE_DIMS, WAGE_CROSS)
    }
    indicators['median_wage_age'] = {
        'label': 'Ingreso mediano por edad (ocupados)', 'unit': 'Gs.',
        'data': aggregate(occ, lambda s: weighted_median(s, 'ipcm'),
                          WAGE_DIMS, WAGE_CROSS)
    }

    return {"indicators": indicators}


def compute_education(reg02):
    print("  Computing education indicators...")
    indicators = {}

    # Literacy (ED02==1 among 15+)
    pop15 = reg02[reg02['P02'] >= 15].copy()
    indicators['literacy_rate'] = {
        'label': 'Tasa de alfabetización (15+)', 'unit': '%',
        'data': aggregate(pop15, lambda s: weighted_pct(s, s['ED02'] == 1) if 'ED02' in s.columns else None,
                          DIMENSIONS, CROSS_TABS_2D)
    }

    # School attendance 6-17
    pop6_17 = reg02[(reg02['P02'] >= 6) & (reg02['P02'] <= 17)].copy()
    indicators['school_attendance'] = {
        'label': 'Asistencia escolar (6-17)', 'unit': '%',
        'data': aggregate(pop6_17, lambda s: weighted_pct(s, s['ED01'] == 1) if 'ED01' in s.columns else None,
                          DIMENSIONS, CROSS_TABS_2D)
    }

    # Mean years of schooling (25+)
    pop25 = reg02[reg02['P02'] >= 25].copy()
    indicators['mean_schooling'] = {
        'label': 'Años de escolaridad promedio (25+)', 'unit': 'años',
        'data': aggregate(pop25, lambda s: weighted_mean(s, 'añoest'),
                          DIMENSIONS, CROSS_TABS_2D)
    }

    # NiNi rate (15-24 not studying and not working)
    pop15_24 = reg02[(reg02['P02'] >= 15) & (reg02['P02'] <= 24)].copy()
    indicators['nini_rate'] = {
        'label': 'Tasa NiNi (15-24)', 'unit': '%',
        'data': aggregate(pop15_24,
                          lambda s: weighted_pct(s, (s['ED01'] != 1) & (~s['CATE_PEA'].isin([1,2,3,4,5,6]))),
                          DIMENSIONS, CROSS_TABS_2D)
    }

    # No education (añoest == 0 among 15+)
    indicators['no_education_rate'] = {
        'label': 'Sin instrucción (15+)', 'unit': '%',
        'data': aggregate(pop15, lambda s: weighted_pct(s, s['añoest'] == 0),
                          DIMENSIONS, CROSS_TABS_2D)
    }

    return {"indicators": indicators}


def compute_housing(reg01):
    print("  Computing housing indicators...")
    indicators = {}

    # Improved water (V06 in 1,2,3,4 = network/piped)
    indicators['improved_water'] = {
        'label': 'Acceso a agua mejorada', 'unit': '%',
        'data': aggregate(reg01, lambda s: weighted_pct(s, s['V06'].isin([1,2,3,4])),
                          DIMS_REG01, CROSS_TABS_REG01)
    }

    # Has bathroom (V12 == 1)
    indicators['has_bathroom'] = {
        'label': 'Hogares con baño', 'unit': '%',
        'data': aggregate(reg01, lambda s: weighted_pct(s, s['V12'] == 1),
                          DIMS_REG01, CROSS_TABS_REG01)
    }

    # Improved sanitation (V13 in 1,2 = sewer/septic)
    indicators['improved_sanitation'] = {
        'label': 'Saneamiento mejorado', 'unit': '%',
        'data': aggregate(reg01, lambda s: weighted_pct(s, s['V13'].isin([1,2])),
                          DIMS_REG01, CROSS_TABS_REG01)
    }

    # Waste collection (V15 in 2,3)
    indicators['waste_collection'] = {
        'label': 'Recolección de basura', 'unit': '%',
        'data': aggregate(reg01, lambda s: weighted_pct(s, s['V15'].isin([2,3])),
                          DIMS_REG01, CROSS_TABS_REG01)
    }

    # Adequate floor (V04 != 1, not dirt)
    indicators['adequate_floor'] = {
        'label': 'Piso no precario', 'unit': '%',
        'data': aggregate(reg01, lambda s: weighted_pct(s, s['V04'] != 1),
                          DIMS_REG01, CROSS_TABS_REG01)
    }

    # Adequate walls (V03 in 4,5 = brick/block)
    indicators['adequate_walls'] = {
        'label': 'Pared no precaria', 'unit': '%',
        'data': aggregate(reg01, lambda s: weighted_pct(s, s['V03'].isin([4,5])),
                          DIMS_REG01, CROSS_TABS_REG01)
    }

    # Adequate roof (V05 in 1,4,6)
    indicators['adequate_roof'] = {
        'label': 'Techo no precario', 'unit': '%',
        'data': aggregate(reg01, lambda s: weighted_pct(s, s['V05'].isin([1,4,6])),
                          DIMS_REG01, CROSS_TABS_REG01)
    }

    # Electricity (V10 == 1)
    indicators['has_electricity'] = {
        'label': 'Acceso a electricidad', 'unit': '%',
        'data': aggregate(reg01, lambda s: weighted_pct(s, s['V10'] == 1),
                          DIMS_REG01, CROSS_TABS_REG01)
    }

    # Internet (V23B == 1)
    indicators['has_internet'] = {
        'label': 'Acceso a internet', 'unit': '%',
        'data': aggregate(reg01, lambda s: weighted_pct(s, s['V23B'] == 1),
                          DIMS_REG01, CROSS_TABS_REG01)
    }

    # Overcrowding (TOTAL / V02B > 3)
    reg01_ov = reg01[(reg01['TOTAL'].notna()) & (reg01['V02B'].notna()) & (reg01['V02B'] > 0)].copy()
    indicators['overcrowding'] = {
        'label': 'Hacinamiento (>3 pers/dormitorio)', 'unit': '%',
        'data': aggregate(reg01_ov, lambda s: weighted_pct(s, (s['TOTAL'] / s['V02B']) > 3),
                          DIMS_REG01, CROSS_TABS_REG01)
    }

    return {"indicators": indicators}


def compute_demographics(reg02):
    print("  Computing demographics indicators...")
    indicators = {}

    # Urban rate
    indicators['urban_rate'] = {
        'label': 'Población urbana', 'unit': '%',
        'data': aggregate(reg02, lambda s: weighted_pct(s, s['AREA'] == 1),
                          {'dpto': DIMENSIONS['dpto'], 'sex': DIMENSIONS['sex'],
                           'poverty': DIMENSIONS['poverty']},
                          [('dpto', 'sex')])
    }

    # Dependency ratio
    indicators['dependency_ratio'] = {
        'label': 'Razón de dependencia', 'unit': '%',
        'data': aggregate(reg02, lambda s: _dependency_ratio(s),
                          DIMENSIONS, CROSS_TABS_2D)
    }

    # Population pyramid data (age_group x sex) - special format
    pyramid = {}
    for y in YEARS:
        sub = reg02[reg02['year'] == y]
        for ag in AGE_LABELS:
            for sx in [1, 6]:
                cell = sub[(sub['age_group'] == ag) & (sub['P06'] == sx)]
                if len(cell) > 0 and cell['FACTOR'].notna().any():
                    pop = int(cell['FACTOR'].sum())
                    pyramid[f"{y}|{ag}|{sx}"] = {"v": pop, "n": int(len(cell))}
    indicators['population_pyramid'] = {
        'label': 'Pirámide poblacional', 'unit': 'personas',
        'data': {"year|age_group|sex": pyramid}
    }

    # Average household size
    indicators['avg_hh_size'] = {
        'label': 'Tamaño medio del hogar', 'unit': 'personas',
        'data': aggregate(reg02, lambda s: _avg_hh_size(s),
                          {'dpto': DIMENSIONS['dpto'], 'area': DIMENSIONS['area']},
                          [('dpto', 'area')])
    }

    return {"indicators": indicators}


def _dependency_ratio(df):
    w = df['FACTOR']
    dep = ((df['P02'] < 15) | (df['P02'] >= 65))
    wap = (df['P02'] >= 15) & (df['P02'] < 65)
    d_sum = (w * dep).sum()
    w_sum = (w * wap).sum()
    if w_sum == 0:
        return None
    return round(100.0 * d_sum / w_sum, 2)


def _avg_hh_size(df):
    # Approximate: count persons per household head
    heads = df[df['P03'] == 1]
    if len(heads) == 0:
        return None
    total_pop = df['FACTOR'].sum()
    total_hh = heads['FACTOR'].sum()
    if total_hh == 0:
        return None
    return round(total_pop / total_hh, 2)


# ============================================================
# Metadata & GeoJSON
# ============================================================

def write_metadata(reg02):
    print("  Writing metadata.json...")
    dptos = sorted(reg02['DPTO'].dropna().unique())
    dpto_map = {str(int(d)): DPTO_LABELS.get(int(d), f"Dpto {int(d)}") for d in dptos}

    meta = {
        "years": YEARS,
        "departments": dpto_map,
        "areas": {"1": "Urbana", "6": "Rural"},
        "sex": {"1": "Hombre", "6": "Mujer"},
        "age_groups": AGE_LABELS,
        "poverty_levels": {"1": "Pobreza extrema", "2": "Pobreza no extrema", "3": "No pobre"},
        "cate_pea": {
            "1": "Empleado/a público", "2": "Empleado/a privado",
            "3": "Empleador/a", "4": "Cuenta propia",
            "5": "Familiar no remunerado", "6": "Empleado/a doméstico"
        },
        "rama_pea": {
            "1": "Agricultura", "2": "Industria", "3": "Electricidad/agua",
            "4": "Construcción", "5": "Comercio/hoteles", "6": "Transporte/comunicaciones",
            "7": "Finanzas/seguros", "8": "Serv. comunales/sociales"
        },
        "condact": {
            "1": "Ocupado/a",
            "2": "Desocupado/a",
            "3": "Inactivo/a"
        },
        "ipc": {
            "base_year": 2022,
            "note": "IPC promedio anual Paraguay, base 2022=100. Fuente: BCP.",
            "2022": 100.0,
            "2023": 108.3,
            "2024": 113.1,
            "2025": 116.5
        }
    }

    with open(OUTPUT_DIR / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)


def prepare_geojson():
    print("  Preparing GeoJSON...")
    import copy
    src = BASE_DIR / "INDICADORES_GR" / "paraguay.json"
    with open(src, 'r', encoding='utf-8') as f:
        geo = json.load(f)

    # Just copy it - frontend will match by dpto property
    with open(OUTPUT_DIR / "geo" / "departamentos.json", "w", encoding="utf-8") as f:
        json.dump(geo, f, ensure_ascii=False)
    print(f"    {len(geo.get('features', []))} features written")


# ============================================================
# Main
# ============================================================

def save_json(data, filename):
    path = OUTPUT_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    size_kb = path.stat().st_size / 1024
    print(f"    -> {filename}: {size_kb:.1f} KB")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "geo").mkdir(exist_ok=True)

    print("=" * 60)
    print("EPHC Dashboard Data Pipeline")
    print("=" * 60)

    print("\nLoading REG02 data...")
    reg02_frames = []
    for y in YEARS:
        reg02_frames.append(load_reg02(y))
    reg02 = pd.concat(reg02_frames, ignore_index=True)
    print(f"  Total REG02: {len(reg02)} rows")

    # Fill dynamic DPTO values
    dpto_vals = sorted(reg02['DPTO'].dropna().unique().tolist())
    DIMENSIONS['dpto']['values'] = [int(d) for d in dpto_vals]
    DIMS_REG01['dpto']['values'] = [int(d) for d in dpto_vals]

    print("\nLoading REG01 data...")
    reg01_frames = []
    for y in YEARS:
        reg01_frames.append(load_reg01(y))
    reg01 = pd.concat(reg01_frames, ignore_index=True)
    print(f"  Total REG01: {len(reg01)} rows")

    print("\nComputing indicators...")
    save_json(compute_poverty(reg02), "poverty.json")
    save_json(compute_employment(reg02), "employment.json")
    save_json(compute_income(reg02), "income.json")
    save_json(compute_education(reg02), "education.json")
    save_json(compute_housing(reg01), "housing.json")
    save_json(compute_demographics(reg02), "demographics.json")

    write_metadata(reg02)
    prepare_geojson()

    print("\n" + "=" * 60)
    print("Pipeline complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
