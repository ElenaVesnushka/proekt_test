/**
 * Атмосферные эффекты интерфейса по данным погоды (деликатные, без «игрушечности»).
 * Ожидает снимок как в WeatherReminders: { weatherCode, tempMax, windKmh, precipMm }.
 * Выставляет data-weather-fx / data-weather-wind на body и наполняет слой #weatherAtmosphere.
 */
(function (global) {
  "use strict";

  var WR = global.WeatherReminders;
  var FLAKE_COUNT = 16;
  var atmosphereEl = null;
  var flakesHost = null;

  function ensureAtmosphere() {
    if (atmosphereEl && document.body.contains(atmosphereEl)) {
      return atmosphereEl;
    }
    atmosphereEl = document.getElementById("weatherAtmosphere");
    if (!atmosphereEl) {
      atmosphereEl = document.createElement("div");
      atmosphereEl.id = "weatherAtmosphere";
      atmosphereEl.className = "weather-atmosphere";
      atmosphereEl.setAttribute("aria-hidden", "true");
      var main = document.querySelector("main.wrap");
      if (main && main.parentNode === document.body) {
        document.body.insertBefore(atmosphereEl, main);
      } else {
        document.body.appendChild(atmosphereEl);
      }
    }
    flakesHost = atmosphereEl.querySelector(".weather-atmosphere__flakes");
    if (!flakesHost) {
      flakesHost = document.createElement("div");
      flakesHost.className = "weather-atmosphere__flakes";
      atmosphereEl.appendChild(flakesHost);
    }
    return atmosphereEl;
  }

  function clearFlakes() {
    if (flakesHost) {
      flakesHost.innerHTML = "";
    }
  }

  function buildFlakes() {
    ensureAtmosphere();
    clearFlakes();
    var i;
    for (i = 0; i < FLAKE_COUNT; i += 1) {
      var span = document.createElement("span");
      span.className = "weather-flake";
      var left = 3 + Math.random() * 94;
      var dur = 14 + Math.random() * 18;
      var delay = Math.random() * -22;
      var size = 2 + Math.random() * 3;
      var drift = (Math.random() - 0.5) * 30;
      span.style.left = left + "%";
      span.style.width = size + "px";
      span.style.height = size + "px";
      span.style.animationDuration = dur + "s";
      span.style.animationDelay = delay + "s";
      span.style.setProperty("--flake-drift", drift + "px");
      flakesHost.appendChild(span);
    }
  }

  /**
   * Определяет основной визуальный режим и усиление ветра (дополнительно к дождю/снегу и т.д.).
   */
  function resolveModes(weather) {
    if (!WR || !weather || typeof weather.weatherCode !== "number") {
      return { fx: "clear", windExtra: false };
    }
    var code = weather.weatherCode;
    var wind = Number(weather.windKmh) || 0;
    var cat = WR.mapWeatherToCategory(weather);

    var snowCodes =
      (code >= 71 && code <= 77) || code === 85 || code === 86;
    var rainCodes =
      cat === "rain" ||
      code === 51 ||
      code === 53 ||
      code === 55 ||
      code === 56 ||
      code === 57 ||
      code === 61 ||
      code === 63 ||
      code === 65 ||
      code === 66 ||
      code === 67 ||
      code === 80 ||
      code === 81 ||
      code === 82 ||
      code === 95 ||
      code === 96 ||
      code === 99;

    var fx = "clear";
    if (snowCodes) {
      fx = "snow";
    } else if (rainCodes) {
      fx = "rain";
    } else if (code === 45 || code === 48 || cat === "fog") {
      fx = "cloud";
    } else if (code === 3 || cat === "cloudy") {
      fx = "cloud";
    } else if (cat === "sunny" || cat === "hot" || code === 0 || code === 1) {
      fx = "sun";
    } else if (cat === "windy") {
      fx = "wind";
    }

    var windExtra = wind >= 28 && fx !== "wind";

    return { fx: fx, windExtra: windExtra };
  }

  /**
   * Применяет визуальную атмосферу к странице.
   * @param {object|null|undefined} weather — снимок погоды или null при сбросе
   */
  function applyWeatherEffects(weather) {
    var body = document.body;
    var el = ensureAtmosphere();

    if (!weather) {
      body.removeAttribute("data-weather-fx");
      body.removeAttribute("data-weather-wind");
      el.className = "weather-atmosphere";
      clearFlakes();
      return;
    }

    var modes = resolveModes(weather);
    body.setAttribute("data-weather-fx", modes.fx);
    if (modes.windExtra || modes.fx === "wind") {
      body.setAttribute("data-weather-wind", "1");
    } else {
      body.removeAttribute("data-weather-wind");
    }

    el.className = "weather-atmosphere weather-atmosphere--" + modes.fx;

    if (modes.fx === "snow") {
      buildFlakes();
    } else {
      clearFlakes();
    }
  }

  global.applyWeatherEffects = applyWeatherEffects;
})(typeof window !== "undefined" ? window : globalThis);
