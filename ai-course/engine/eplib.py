# -*- coding: utf-8 -*-
"""Помощники для сценариев эпизодов."""
from num2words import num2words

def _prep(word):
    for a, b in (("ый", "ом"), ("ой", "ом"), ("ий", "ем")):
        if word.endswith(a): return word[:-2] + b
    return word

def Y(year):
    """Год в предложном падеже: «в {Y(1950)} году» -> «в тысяча девятьсот пятидесятом году»."""
    words = num2words(year, lang="ru", to="ordinal").split()
    words[-1] = _prep(words[-1]); return "{%d|%s}" % (year, " ".join(words))

def N(display, spoken):
    return "{%s|%s}" % (display, spoken)

def B(text, mood=None, pause=None, **kw):
    """Бит озвучки: текст + необязательные настройки (настроение талисмана, пауза после)."""
    o = dict(kw)
    if mood: o["mood"] = mood
    if pause is not None: o["pause"] = pause
    return (text, o)
