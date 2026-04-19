/**
 * Главная страница: дата, погода Open-Meteo, фон месяца, праздник, послание дня, напоминание.
 *
 * Центральная перерисовка: updateUI(iso, options)
 *   options.reminderFromWeather — снимок погоды для шуточно-заботливого текста (weather-reminders.js)
 *   options.reminderOverride — строка вместо погоды (будущая дата и т.п.)
 *   options.skipWeatherDependent — только календарь/фон/послание/праздник
 *
 * Погода: geocode → forecast (сегодня) или archive (прошлое). Текущие условия — getWeatherByCoords
 * (см. WeatherReminders), если выбран сегодняшний день, для более живого напоминания.
 *
 * Геолокация: при пустом поле города, если браузер дал координаты, используем их (без отдельного API-ключа).
 */
(function () {
  "use strict";

  var CD = window.CalendarData;
  var WR = window.WeatherReminders;

  var dateEl = document.getElementById("currentDate");
  var dateInput = document.getElementById("dateInput");
  var cityInput = document.getElementById("cityInput");
  var loadBtn = document.getElementById("loadBtn");
  var seasonSelect = document.getElementById("seasonSelect");
  var statusEl = document.getElementById("status");
  var cityLabel = document.getElementById("cityLabel");
  var weatherSummary = document.getElementById("weatherSummary");
  var weatherBox = document.getElementById("weatherBox");
  var dayMoodText = document.getElementById("dayMoodText");
  var holidayText = document.getElementById("holidayText");
  var holidayMeta = document.getElementById("holidayMeta");
  var holidayNote = document.getElementById("holidayNote");
  var holidayExtras = document.getElementById("holidayExtras");
  var reminderText = document.getElementById("reminderText");
  var reminderBlock = document.getElementById("reminderBlock");

  /** Координаты из navigator.geolocation (без ключа), если пользователь разрешил */
  var geoLat = null;
  var geoLon = null;

  var MONTH_BG_NAMES = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december"
  ];

  var formatterLong = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  function getTodayIso() {
    var t = new Date();
    return (
      t.getFullYear() +
      "-" +
      String(t.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(t.getDate()).padStart(2, "0")
    );
  }

  function parseIso(iso) {
    var p = iso.split("-");
    return {
      y: parseInt(p[0], 10),
      m: parseInt(p[1], 10),
      d: parseInt(p[2], 10)
    };
  }

  function getSelectedIso() {
    return dateInput.value || getTodayIso();
  }

  function compareIso(a, b) {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  function getSeasonByMonth(monthIndex0) {
    if (monthIndex0 >= 2 && monthIndex0 <= 4) return "spring";
    if (monthIndex0 >= 5 && monthIndex0 <= 7) return "summer";
    if (monthIndex0 >= 8 && monthIndex0 <= 10) return "autumn";
    return "winter";
  }

  function applySeasonTheme() {
    var selected = seasonSelect.value;
    var iso = getSelectedIso();
    var month0 = parseIso(iso).m - 1;
    var finalSeason = selected === "auto" ? getSeasonByMonth(month0) : selected;
    document.body.dataset.season = finalSeason;
  }

  /**
   * Фон по месяцу выбранной даты: сначала english name (january.jpg), затем fallback 01.jpg.
   * Плавность — opacity на body::before (theme.css) + смена --month-photo.
   */
  function setMonthBackground(month1to12) {
    document.body.dataset.month = String(month1to12);
    var name = MONTH_BG_NAMES[month1to12 - 1];
    var tryUrls = ["assets/month/" + name + ".jpg", "assets/month/" + String(month1to12).padStart(2, "0") + ".jpg"];
    var i = 0;

    function tryNext() {
      if (i >= tryUrls.length) {
        document.body.style.setProperty("--month-photo", "none");
        document.body.removeAttribute("data-photo-ready");
        return;
      }
      var img = new Image();
      img.onload = function () {
        document.body.style.setProperty("--month-photo", "url(" + tryUrls[i] + ")");
        document.body.setAttribute("data-photo-ready", "1");
      };
      img.onerror = function () {
        i += 1;
        tryNext();
      };
      img.src = tryUrls[i];
    }

    tryNext();
  }

  function weatherCodeToText(code) {
    var map = {
      0: "Ясно",
      1: "Преимущественно ясно",
      2: "Переменная облачность",
      3: "Пасмурно",
      45: "Туман",
      48: "Туман с инеем",
      51: "Слабая морось",
      53: "Морось",
      55: "Сильная морось",
      61: "Слабый дождь",
      63: "Дождь",
      65: "Сильный дождь",
      71: "Слабый снег",
      73: "Снег",
      75: "Сильный снег",
      80: "Ливневый дождь",
      95: "Гроза"
    };
    return map[code] ?? "Неизвестно";
  }

  function formatISODate(isoDate) {
    return new Intl.DateTimeFormat("ru-RU", {
      weekday: "short",
      day: "numeric",
      month: "short"
    }).format(new Date(isoDate));
  }

  function renderHolidayForDate(iso) {
    var pack = CD.getHolidayForDate(iso);
    if (pack.primary) {
      holidayText.textContent = pack.primary.title;
      holidayMeta.textContent = pack.primary.typeLabel;
      holidayMeta.hidden = false;
      holidayNote.textContent = pack.primary.note;
      holidayNote.hidden = false;
      if (pack.extras.length > 0) {
        holidayExtras.textContent = pack.extras
          .map(function (ex) {
            return "• " + ex.title + " (" + ex.typeLabel + ")";
          })
          .join(" ");
        holidayExtras.hidden = false;
      } else {
        holidayExtras.textContent = "";
        holidayExtras.hidden = true;
      }
    } else {
      holidayText.textContent = "Без особой отметки в календаре";
      holidayMeta.textContent = "";
      holidayMeta.hidden = true;
      holidayNote.textContent = CD.holidayFallbackLine(iso);
      holidayNote.hidden = false;
      holidayExtras.textContent = "";
      holidayExtras.hidden = true;
    }
  }

  /**
   * Центральное обновление «тихой» части интерфейса по дате (без погодного напоминания).
   * Напоминание дозируется отдельно: updateReminderBlock (после API или fallback).
   */
  function updateUI(iso) {
    var d = parseIso(iso);
    dateEl.textContent = "Выбранный день: " + formatterLong.format(new Date(iso + "T12:00:00"));
    setMonthBackground(d.m);
    applySeasonTheme();
    dayMoodText.textContent = CD.getDailyMessage(iso);
    renderHolidayForDate(iso);
  }

  /**
   * Напоминание: приоритет погоды из API; иначе нейтральный fallback по дате.
   * explicitText — когда погода не нужна (будущее) или особый текст.
   */
  function updateReminderBlock(iso, weatherSnapshot, explicitText) {
    var text;
    if (explicitText != null && explicitText !== "") {
      text = explicitText;
    } else if (weatherSnapshot) {
      text = WR.getWeatherReminder(weatherSnapshot, iso);
    } else {
      text = CD.pickGenericReminder(iso);
    }
    reminderText.textContent = text;
    reminderBlock.classList.remove("is-updated");
    void reminderBlock.offsetWidth;
    reminderBlock.classList.add("is-updated");
    reminderText.classList.remove("reminder-fade");
    void reminderText.offsetWidth;
    reminderText.classList.add("reminder-fade");
  }

  function tryGeolocationOnce() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        geoLat = pos.coords.latitude;
        geoLon = pos.coords.longitude;
      },
      function () {},
      { timeout: 12000, maximumAge: 600000 }
    );
  }

  async function resolveLocation(city) {
    var trimmed = city.trim();
    if (trimmed.length === 0 && geoLat != null && geoLon != null) {
      return {
        latitude: geoLat,
        longitude: geoLon,
        timezone: "auto",
        name: "Местоположение (геолокация)",
        country: ""
      };
    }
    if (trimmed.length === 0) {
      throw new Error("Введите город или очистите поле и разрешите геолокацию.");
    }
    return geocodeCity(trimmed);
  }

  async function geocodeCity(city) {
    var params = new URLSearchParams({
      name: city,
      count: "1",
      language: "ru",
      format: "json"
    });
    var res = await fetch("https://geocoding-api.open-meteo.com/v1/search?" + params.toString());
    if (!res.ok) {
      throw new Error("Не удалось получить координаты города");
    }
    var data = await res.json();
    if (!data.results || data.results.length === 0) {
      throw new Error("Город не найден");
    }
    return data.results[0];
  }

  async function fetchForecast(lat, lon, timezone) {
    var params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max",
      timezone: timezone || "auto",
      forecast_days: "2"
    });
    var res = await fetch("https://api.open-meteo.com/v1/forecast?" + params.toString());
    if (!res.ok) {
      throw new Error("Не удалось получить прогноз погоды");
    }
    return res.json();
  }

  async function fetchHistoricalDaily(lat, lon, timezone, dateStr) {
    var params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      timezone: timezone || "auto",
      start_date: dateStr,
      end_date: dateStr,
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max"
    });
    var res = await fetch("https://archive-api.open-meteo.com/v1/archive?" + params.toString());
    if (!res.ok) {
      throw new Error("Архив погоды недоступен для этой даты");
    }
    return res.json();
  }

  function renderWeatherLines(daily) {
    weatherBox.innerHTML = "";
    var i;
    for (i = 0; i < daily.time.length; i += 1) {
      var line = document.createElement("div");
      line.className = "weather-line";
      line.innerHTML =
        "<strong>" +
        formatISODate(daily.time[i]) +
        "</strong>" +
        "<span>" +
        weatherCodeToText(daily.weather_code[i]) +
        ", " +
        Math.round(daily.temperature_2m_min[i]) +
        "..." +
        Math.round(daily.temperature_2m_max[i]) +
        "°C, осадки: " +
        daily.precipitation_sum[i] +
        " мм, ветер: " +
        daily.windspeed_10m_max[i] +
        " км/ч</span>";
      weatherBox.appendChild(line);
    }
  }

  function oneLineSummary(daily, idx) {
    idx = idx || 0;
    return (
      "Коротко: " +
      weatherCodeToText(daily.weather_code[idx]) +
      ", " +
      Math.round(daily.temperature_2m_min[idx]) +
      "…" +
      Math.round(daily.temperature_2m_max[idx]) +
      "°C, осадки " +
      daily.precipitation_sum[idx] +
      " мм."
    );
  }

  async function updateAll() {
    var city = cityInput.value;
    var iso = getSelectedIso();
    var todayIso = getTodayIso();

    updateUI(iso);
    weatherSummary.textContent = "";
    updateReminderBlock(iso, null, null);

    var geo;
    try {
      geo = await resolveLocation(city);
      cityLabel.textContent = "Город: " + geo.name + (geo.country ? ", " + geo.country : "");
    } catch (e) {
      statusEl.textContent = e.message || "Ошибка";
      weatherBox.innerHTML = "";
      updateReminderBlock(iso, null, CD.pickGenericReminder(iso));
      return;
    }

    var cmp = compareIso(iso, todayIso);

    statusEl.textContent = "Загружаю данные…";
    weatherBox.innerHTML = "";

    try {
      if (cmp > 0) {
        weatherSummary.textContent =
          "Прогноз на будущую дату здесь не строим — выберите сегодня или прошлый день для фактической погоды.";
        weatherBox.innerHTML =
          "<p class=\"panel-note\">Настроение дня и календарь уже подстроены под выбранную дату.</p>";
        updateReminderBlock(
          iso,
          null,
          "Будущее ещё в разработке у облаков — а ты можешь спланировать тёплый день и удобную одежду заранее."
        );
        statusEl.textContent = "Погода: доступна для сегодня и прошлого.";
        return;
      }

      if (cmp === 0) {
        var forecast = await fetchForecast(geo.latitude, geo.longitude, geo.timezone);
        renderWeatherLines(forecast.daily);
        weatherSummary.textContent = oneLineSummary(forecast.daily, 0);

        var snap = WR.snapshotFromDailyRow(forecast.daily, 0);
        try {
          var curJson = await WR.getWeatherByCoords(geo.latitude, geo.longitude, geo.timezone);
          if (curJson && curJson.current) {
            snap = WR.snapshotFromCurrent(curJson.current);
          }
        } catch (curErr) {
          /* оставляем снимок из дневной строки прогноза */
        }

        updateReminderBlock(iso, snap, null);
        statusEl.textContent = "Данные обновлены (прогноз + текущие условия, если доступны).";
        return;
      }

      var arch = await fetchHistoricalDaily(geo.latitude, geo.longitude, geo.timezone, iso);
      if (!arch.daily || !arch.daily.time || arch.daily.time.length === 0) {
        throw new Error("Нет строки в архиве за эту дату");
      }
      renderWeatherLines(arch.daily);
      weatherSummary.textContent = oneLineSummary(arch.daily, 0) + " (архив).";
      var pastSnap = WR.snapshotFromDailyRow(arch.daily, 0);
      updateReminderBlock(iso, pastSnap, null);
      statusEl.textContent = "Загружен архив за выбранный день.";
    } catch (err) {
      statusEl.textContent = err.message || "Ошибка загрузки.";
      weatherSummary.textContent = "";
      updateReminderBlock(iso, null, "Погода не подгрузилась — " + CD.pickGenericReminder(iso));
    }
  }

  if (!dateInput.value) {
    dateInput.value = getTodayIso();
  }

  cityInput.addEventListener("input", function () {
    /* при ручном вводе города геолокация не подменяет адрес, но координаты могут остаться для «пустого» поля */
  });

  loadBtn.addEventListener("click", updateAll);
  seasonSelect.addEventListener("change", applySeasonTheme);
  dateInput.addEventListener("change", function () {
    updateAll();
  });
  cityInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      updateAll();
    }
  });

  tryGeolocationOnce();
  updateAll();
})();
