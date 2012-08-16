/**
 * '||''''|                                     .             .
 *  ||  .    .. ...   .... ...  ....    ....  .||.   ....   .||.   ....
 *  ||''|     ||  ||   '|.  |  '' .||  ||. '   ||   '' .||   ||   ||. '
 *  ||        ||  ||    '|.|   .|' ||  . '|..  ||   .|' ||   ||   . '|..
 * .||.....| .||. ||.    '|    '|..'|' |'..|'  '|.' '|..'|'  '|.' |'..|'
 *
 * Copyright (c) 2012 Display:inline
 * @mail contact@display-inline.fr
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software
 * and associated documentation files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
 * BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * -------------------------------------------------------------------------------------------------
 *
 * How does this thing work?
 *
 * This extension is basically built around an IndexedDB database which stores the sales statement.
 *
 * There are 2 main types of objects:
 *
 * - Publishers: those objects are meant to load and store specific data, and provide an API to
 *   add callbacks which will be fired everytime the data is loaded or changes. There are 3 types
 *   of publishers:
 *   - options (stored using LocalStorage)
 *   - ressources (data loaded via Envato API)
 *   - requests (data loaded in the database)
 *   Publishers can listen to others publishers, so they may update their internal data whenever
 *   something changes (an option, for instance)
 *
 * - Widgets: those are the actual visible parts of the dashboard. They listen to one or several
 *   publishers, and are refreshed everytime one of them changes.
 *
 * All objects are stored in the library object.
 *
 * The startup process:
 *
 * - The local database is opened, and the tables are created if they don't exist
 * - The latest statement files are loaded to refresh the database
 * - If an alternate currency is set, the current rate is loaded, and applyed to recents sales
 *   in the database
 * - Then the main widgets screen is built and shown
 *
 * Content summary:
 *
 * - variables declaration
 * - init process
 * - core functions
 * - classes
 * - controls declaration
 * - options declaration
 * - request declaration
 * - widgets declaration
 * - currency functions
 * - utility functions
 * - Elychart templates
 */

;(function ($, window, document, undefined)
{
		/*
		 * Global vars
		 */

		// Database and local storage
	var db, storage,

		// Username and domain
		username = $.trim( $( '#user_username' ).text() ),
		domain   = document.location.protocol + '//' + document.location.hostname,

		// Prefixed names
		storageName = 'envastats-' + username + '-',
		dbName      = 'envastats_' + username.replace( /[^a-zA-Z0-9]+/, '' ),

		/*
		 * Envato vars
		 */
		envato = {

			// API
			api: {
				version: 3,
				url: 'http://marketplace.envato.com/api/v3/'
			},

			// Statements
			statement: {

				// Type codes, used to save storing space in DB
				types: {
					'sale':			1,
					'withdrawal':	2,
					'referral_cut':	3,
					'deposit':		4,
					'purchase':		5,
					'refund':		6,		// Not sure of this one

					'other':		0		// For unknown types
				}

			},

			// Badges
			badges: {

				// Paws
				paws: [
					{ start: 0,				name: 'Orange Paw'			},
					{ start: 100,			name: 'Brown Paw'			},
					{ start: 1000,			name: 'Red Paw'				},
					{ start: 5000,			name: 'Black Paw'			},
					{ start: 10000,			name: 'Silver Paw'			},
					{ start: 50000,			name: 'Gold Paw'			},
					{ start: 100000,		name: 'Blue Steel Paw'		},
					{ start: 250000,		name: 'Plutonium Paw'		},
					{ start: 1000000,		name: 'Power Elite Paw'		}
				],

				// Commission/elite levels
				elite: [
					{ start: 0,				name: 'Rate 50%'			},
					{ start: 3750,			name: 'Rate 51%'			},
					{ start: 7500,			name: 'Rate 52%'			},
					{ start: 11250,			name: 'Rate 53%'			},
					{ start: 15000,			name: 'Rate 54%'			},
					{ start: 18750,			name: 'Rate 55%'			},
					{ start: 22500,			name: 'Rate 56%'			},
					{ start: 26250,			name: 'Rate 57%'			},
					{ start: 30000,			name: 'Rate 58%'			},
					{ start: 33750,			name: 'Rate 59%'			},
					{ start: 37500,			name: 'Rate 60%'			},
					{ start: 41250,			name: 'Rate 61%'			},
					{ start: 45000,			name: 'Rate 62%'			},
					{ start: 48750,			name: 'Rate 63%'			},
					{ start: 52500,			name: 'Rate 64%'			},
					{ start: 56250,			name: 'Rate 65%'			},
					{ start: 60000,			name: 'Rate 66%'			},
					{ start: 63750,			name: 'Rate 67%'			},
					{ start: 67500,			name: 'Rate 68%'			},
					{ start: 71250,			name: 'Rate 69%'			},

					{ start: 75000,			name: 'Elite level 1'		},
					{ start: 125000,		name: 'Elite level 2'		},
					{ start: 250000,		name: 'Elite level 3'		},
					{ start: 500000,		name: 'Elite level 4'		},
					{ start: 750000,		name: 'Elite level 5'		},
					{ start: 1000000,		name: 'Power Elite level 1'	},
					{ start: 2500000,		name: 'Power Elite level 2'	},
					{ start: 5000000,		name: 'Power Elite level 3'	},
					{ start: 10000000,		name: 'Power Elite level 4'	}
				]

			},

			// Currency of statements
			currency: 'USD'

		},

		/*
		 * Currency rates using Open Exchange Rates API
		 */

		rates = {

			// API
			api: {

				// Current rates
				latest: 'http://openexchangerates.org/api/latest.json',

				// Historical rates
				historical: 'http://openexchangerates.org/api/historical/{{date}}.json'

			},

			// Validity of latest rates (2H)
			latestExpiration: 2 * 60 * 60 * 1000,

			// List of awaiting callbacks
			callbacks: {},

			// State if a database update of rates is going on
			updating: false,

			// If option changes while a previous update is still running, store new value here
			waiting: false,

			// Currencies
			currencies: {
				EUR: 'Euro',
				AED: 'United Arab Emirates Dirham',
				AFN: 'Afghan Afghani',
				ALL: 'Albanian Lek',
				AMD: 'Armenian Dram',
				ANG: 'Netherlands Antillean Guilder',
				AOA: 'Angolan Kwanza',
				ARS: 'Argentine Peso',
				AUD: 'Australian Dollar',
				AWG: 'Aruban Florin',
				AZN: 'Azerbaijani Manat',
				BAM: 'Bosnia-Herzegovina Convertible Mark',
				BBD: 'Barbadian Dollar',
				BDT: 'Bangladeshi Taka',
				BGN: 'Bulgarian Lev',
				BHD: 'Bahraini Dinar',
				BIF: 'Burundian Franc',
				BMD: 'Bermudan Dollar',
				BND: 'Brunei Dollar',
				BOB: 'Bolivian Boliviano',
				BRL: 'Brazilian Real',
				BSD: 'Bahamian Dollar',
				BTN: 'Bhutanese Ngultrum',
				BWP: 'Botswanan Pula',
				BYR: 'Belarusian Ruble',
				BZD: 'Belize Dollar',
				CAD: 'Canadian Dollar',
				CDF: 'Congolese Franc',
				CHF: 'Swiss Franc',
				CLF: 'Chilean Unit of Account (UF)',
				CLP: 'Chilean Peso',
				CNY: 'Chinese Yuan',
				COP: 'Colombian Peso',
				CRC: 'Costa Rican Colón',
				CUP: 'Cuban Peso',
				CVE: 'Cape Verdean Escudo',
				CZK: 'Czech Republic Koruna',
				DJF: 'Djiboutian Franc',
				DKK: 'Danish Krone',
				DOP: 'Dominican Peso',
				DZD: 'Algerian Dinar',
				EGP: 'Egyptian Pound',
				ETB: 'Ethiopian Birr',
				FJD: 'Fijian Dollar',
				FKP: 'Falkland Islands Pound',
				GBP: 'British Pound Sterling',
				GEL: 'Georgian Lari',
				GHS: 'Ghanaian Cedi',
				GIP: 'Gibraltar Pound',
				GMD: 'Gambian Dalasi',
				GNF: 'Guinean Franc',
				GTQ: 'Guatemalan Quetzal',
				GYD: 'Guyanaese Dollar',
				HKD: 'Hong Kong Dollar',
				HNL: 'Honduran Lempira',
				HRK: 'Croatian Kuna',
				HTG: 'Haitian Gourde',
				HUF: 'Hungarian Forint',
				IDR: 'Indonesian Rupiah',
				ILS: 'Israeli New Sheqel',
				INR: 'Indian Rupee',
				IQD: 'Iraqi Dinar',
				IRR: 'Iranian Rial',
				ISK: 'Icelandic Króna',
				JMD: 'Jamaican Dollar',
				JOD: 'Jordanian Dinar',
				JPY: 'Japanese Yen',
				KES: 'Kenyan Shilling',
				KGS: 'Kyrgystani Som',
				KHR: 'Cambodian Riel',
				KMF: 'Comorian Franc',
				KPW: 'North Korean Won',
				KRW: 'South Korean Won',
				KWD: 'Kuwaiti Dinar',
				KZT: 'Kazakhstani Tenge',
				LAK: 'Laotian Kip',
				LBP: 'Lebanese Pound',
				LKR: 'Sri Lankan Rupee',
				LRD: 'Liberian Dollar',
				LSL: 'Lesotho Loti',
				LTL: 'Lithuanian Litas',
				LVL: 'Latvian Lats',
				LYD: 'Libyan Dinar',
				MAD: 'Moroccan Dirham',
				MDL: 'Moldovan Leu',
				MGA: 'Malagasy Ariary',
				MKD: 'Macedonian Denar',
				MMK: 'Myanma Kyat',
				MNT: 'Mongolian Tugrik',
				MOP: 'Macanese Pataca',
				MRO: 'Mauritanian Ouguiya',
				MUR: 'Mauritian Rupee',
				MVR: 'Maldivian Rufiyaa',
				MWK: 'Malawian Kwacha',
				MXN: 'Mexican Peso',
				MYR: 'Malaysian Ringgit',
				MZN: 'Mozambican Metical',
				NAD: 'Namibian Dollar',
				NGN: 'Nigerian Naira',
				NIO: 'Nicaraguan Córdoba',
				NOK: 'Norwegian Krone',
				NPR: 'Nepalese Rupee',
				NZD: 'New Zealand Dollar',
				OMR: 'Omani Rial',
				PAB: 'Panamanian Balboa',
				PEN: 'Peruvian Nuevo Sol',
				PGK: 'Papua New Guinean Kina',
				PHP: 'Philippine Peso',
				PKR: 'Pakistani Rupee',
				PLN: 'Polish Zloty',
				PYG: 'Paraguayan Guarani',
				QAR: 'Qatari Rial',
				RON: 'Romanian Leu',
				RSD: 'Serbian Dinar',
				RUB: 'Russian Ruble',
				RWF: 'Rwandan Franc',
				SAR: 'Saudi Riyal',
				SBD: 'Solomon Islands Dollar',
				SCR: 'Seychellois Rupee',
				SDG: 'Sudanese Pound',
				SEK: 'Swedish Krona',
				SGD: 'Singapore Dollar',
				SHP: 'Saint Helena Pound',
				SLL: 'Sierra Leonean Leone',
				SOS: 'Somali Shilling',
				SRD: 'Surinamese Dollar',
				STD: 'São Tomé and Príncipe Dobra',
				SVC: 'Salvadoran Colón',
				SYP: 'Syrian Pound',
				SZL: 'Swazi Lilangeni',
				THB: 'Thai Baht',
				TJS: 'Tajikistani Somoni',
				TMT: 'Turkmenistani Manat',
				TND: 'Tunisian Dinar',
				TOP: 'Tongan Paʻanga',
				TRY: 'Turkish Lira',
				TTD: 'Trinidad and Tobago Dollar',
				TWD: 'New Taiwan Dollar',
				TZS: 'Tanzanian Shilling',
				UAH: 'Ukrainian Hryvnia',
				UGX: 'Ugandan Shilling',
				USD: 'United States Dollar',
				UYU: 'Uruguayan Peso',
				UZS: 'Uzbekistan Som',
				VEF: 'Venezuelan Bolívar',
				VND: 'Vietnamese Dong',
				VUV: 'Vanuatu Vatu',
				WST: 'Samoan Tala',
				XAF: 'CFA Franc BEAC',
				XCD: 'East Caribbean Dollar',
				XDR: 'Special Drawing Rights',
				XOF: 'CFA Franc BCEAO',
				XPF: 'CFP Franc',
				YER: 'Yemeni Rial',
				ZAR: 'South African Rand',
				ZMK: 'Zambian Kwacha',
				ZWL: 'Zimbabwean Dollar'
			},

			// Symbols
			symbols: {
				AFN: '؋',
				ARS: '$',
				AWG: 'ƒ',
				AUD: '$',
				AZN: 'ман',
				BSD: '$',
				BBD: '$',
				BYR: 'p.',
				BZD: 'BZ$',
				BMD: '$',
				BOB: '$b',
				BAM: 'KM',
				BWP: 'P',
				BGN: 'лв',
				BRL: 'R$',
				BND: '$',
				KHR: '៛',
				CAD: '$',
				KYD: '$',
				CLP: '$',
				CNY: '¥',
				COP: '$',
				CRC: '₡',
				HRK: 'kn',
				CUP: '₱',
				CZK: 'Kč',
				DKK: 'kr',
				DOP: 'RD$',
				XCD: '$',
				EGP: '£',
				SVC: '$',
				EEK: 'kr',
				EUR: '€',
				FKP: '£',
				FJD: '$',
				GHC: '¢',
				GIP: '£',
				GTQ: 'Q',
				GGP: '£',
				GYD: '$',
				HNL: 'L',
				HKD: '$',
				HUF: 'Ft',
				ISK: 'kr',
				INR: '₹',
				IDR: 'Rp',
				IRR: '﷼',
				IMP: '£',
				ILS: '₪',
				JMD: 'J$',
				JPY: '¥',
				JEP: '£',
				KZT: 'лв',
				KPW: '₩',
				KRW: '₩',
				KGS: 'лв',
				LAK: '₭',
				LVL: 'Ls',
				LBP: '£',
				LRD: '$',
				LTL: 'Lt',
				MKD: 'ден',
				MYR: 'RM',
				MUR: '₨',
				MXN: '$',
				MNT: '₮',
				MZN: 'MT',
				NAD: '$',
				NPR: '₨',
				ANG: 'ƒ',
				NZD: '$',
				NIO: 'C$',
				NGN: '₦',
				KPW: '₩',
				NOK: 'kr',
				OMR: '﷼',
				PKR: '₨',
				PAB: 'B/.',
				PYG: 'Gs',
				PEN: 'S/.',
				PHP: '₱',
				PLN: 'zł',
				QAR: '﷼',
				RUB: 'руб',
				SHP: '£',
				SAR: '﷼',
				RSD: 'Дин.',
				SCR: '₨',
				SGD: '$',
				SBD: '$',
				SOS: 'S',
				ZAR: 'R',
				KRW: '₩',
				LKR: '₨',
				SEK: 'kr',
				SRD: '$',
				SYP: '£',
				TWD: 'NT$',
				THB: '฿',
				TTD: 'TT$',
				TRL: '₤',
				TVD: '$',
				UAH: '₴',
				GBP: '£',
				USD: '$',
				UYU: '$U',
				UZS: 'лв',
				VEF: 'Bs',
				VND: '₫',
				YER: '﷼',
				ZWD: 'Z$'
			}

		},

		/*
		 * Dates
		 *
		 * Working with dates is a bit tricky (for me) because of timezones offsets, so here's how I handle it:
		 * - reference time is Envato's time, because statements files use it
		 * - the date object 'now' handles the actual time at Envato
		 * - other dates (for instance, 'today') are based on 'now's date and used only for the date functions, the time part is ignored
		 * - widgets/requests that should be refreshed everytime the time changes just need to listen to the option now (updated every minute)
		 * - widgets/requests that should be refreshed everytime the date changes just need to listen to the option today
		 * - firstSale is the date of the first sale in the database, use only for the date part (time not handled)
		 */

		// Dates (local and at Envato's HQ, GMT +10)
		nowLocal   = new Date(),
		timeOffset = ( nowLocal.getTimezoneOffset() * 60000 ) + ( 10 * 3600000 ),
		now        = new Date( nowLocal.getTime() + timeOffset ),
		nowMonth   = now.getMonth(),
		nowYear    = now.getFullYear(),
		today      = new Date( nowYear, nowMonth, now.getDate() ),
		firstSale  = false,

		/*
		 * l10n / i18n
		 * Basic implementation
		 */

		l10n = {

			// Numeric formats
			thousands_sep:      chrome.i18n.getMessage( 'thousands_sep' ),
			dec_point:          chrome.i18n.getMessage( 'dec_point' ),
			currency_display:   chrome.i18n.getMessage( 'currency_display' ),

			// Date format
			date_formats: {
				'default':      chrome.i18n.getMessage( 'dateFormat_default' ),
				shortDate:      chrome.i18n.getMessage( 'dateFormat_shortDate' ),
				mediumDate:     chrome.i18n.getMessage( 'dateFormat_mediumDate' ),
				longDate:       chrome.i18n.getMessage( 'dateFormat_longDate' ),
				fullDate:       chrome.i18n.getMessage( 'dateFormat_fullDate' ),
				shortTime:      chrome.i18n.getMessage( 'dateFormat_shortTime' ),
				mediumTime:     chrome.i18n.getMessage( 'dateFormat_mediumTime' ),
				longTime:       chrome.i18n.getMessage( 'dateFormat_longTime' ),
				isoDate:        chrome.i18n.getMessage( 'dateFormat_isoDate' ),
				isoTime:        chrome.i18n.getMessage( 'dateFormat_isoTime' ),
				sqlDatetime:	chrome.i18n.getMessage( 'dateFormat_sqlDatetime' ),
				week:			chrome.i18n.getMessage( 'dateFormat_week' ),
				month:			chrome.i18n.getMessage( 'dateFormat_month' ),
			}
		},

		i18n = {

			// Months/days names
			months:			[ chrome.i18n.getMessage( 'months_January' ),
							  chrome.i18n.getMessage( 'months_February' ),
							  chrome.i18n.getMessage( 'months_March' ),
							  chrome.i18n.getMessage( 'months_April' ),
							  chrome.i18n.getMessage( 'months_May' ),
							  chrome.i18n.getMessage( 'months_June' ),
							  chrome.i18n.getMessage( 'months_July' ),
							  chrome.i18n.getMessage( 'months_August' ),
							  chrome.i18n.getMessage( 'months_September' ),
							  chrome.i18n.getMessage( 'months_October' ),
							  chrome.i18n.getMessage( 'months_November' ),
							  chrome.i18n.getMessage( 'months_December' ) ],
			monthsShort:	[ chrome.i18n.getMessage( 'monthsShort_January' ),
							  chrome.i18n.getMessage( 'monthsShort_February' ),
							  chrome.i18n.getMessage( 'monthsShort_March' ),
							  chrome.i18n.getMessage( 'monthsShort_April' ),
							  chrome.i18n.getMessage( 'monthsShort_May' ),
							  chrome.i18n.getMessage( 'monthsShort_June' ),
							  chrome.i18n.getMessage( 'monthsShort_July' ),
							  chrome.i18n.getMessage( 'monthsShort_August' ),
							  chrome.i18n.getMessage( 'monthsShort_September' ),
							  chrome.i18n.getMessage( 'monthsShort_October' ),
							  chrome.i18n.getMessage( 'monthsShort_November' ),
							  chrome.i18n.getMessage( 'monthsShort_December' ) ],
			days:			[ chrome.i18n.getMessage( 'days_Sunday' ),
							  chrome.i18n.getMessage( 'days_Monday' ),
							  chrome.i18n.getMessage( 'days_Tuesday' ),
							  chrome.i18n.getMessage( 'days_Wednesday' ),
							  chrome.i18n.getMessage( 'days_Thursday' ),
							  chrome.i18n.getMessage( 'days_Friday' ),
							  chrome.i18n.getMessage( 'days_Saturday' ) ],
			daysShort:		[ chrome.i18n.getMessage( 'daysShort_Sunday' ),
							  chrome.i18n.getMessage( 'daysShort_Monday' ),
							  chrome.i18n.getMessage( 'daysShort_Tuesday' ),
							  chrome.i18n.getMessage( 'daysShort_Wednesday' ),
							  chrome.i18n.getMessage( 'daysShort_Thursday' ),
							  chrome.i18n.getMessage( 'daysShort_Friday' ),
							  chrome.i18n.getMessage( 'daysShort_Saturday' ) ],
			daysLetter:		[ chrome.i18n.getMessage( 'daysLetter_Sunday' ),
							  chrome.i18n.getMessage( 'daysLetter_Monday' ),
							  chrome.i18n.getMessage( 'daysLetter_Tuesday' ),
							  chrome.i18n.getMessage( 'daysLetter_Wednesday' ),
							  chrome.i18n.getMessage( 'daysLetter_Thursday' ),
							  chrome.i18n.getMessage( 'daysLetter_Friday' ),
							  chrome.i18n.getMessage( 'daysLetter_Saturday' ) ]

		},

		/*
		 * Blocks
		 */

		// Main content wrapper
		wrapper = $( '<div class="envastats"></div>' ).insertBefore( '.content-l:first' ),

		// Screens and blocks
		screens = {
			current: false
		},


		/*
		 * Storage
		 */

		// Library
		library = {
			controls:	{},
			options:	{},
			ressources: { items: {} },
			requests:   {},
			widgets:    {}
		},

		// List of declared widgets screens
		widgets = {};

	/**
	 * Get l10n value
	 * @param string name l10n value name
	 * @return string|array the localized value
	 */
	function __l10n( name )
	{
		return l10n[ name ] || '';
	}

	/**
	 * Get i18n value
	 * @param string name i18n value name
	 * @return string|array the internationalized value
	 */
	function __i18n( name )
	{
		return i18n[ name ] || '';
	}


	/*************************************************************************/
	/*                              Init plugin                              */
	/*************************************************************************/

	// Check environment
	if ( !username || username.length === 0 )
	{
		return;
	}

	// Add init screen
	screens.init = addScreen( 'init' ).append( '<h2>Envastats</h2>' );
	screens.initStatus = $( '<p class="envastats-loading">' + chrome.i18n.getMessage( 'loadingDatabase' ) + '</p>' ).appendTo( screens.init );
	showScreen( screens.init );

	// Setup tables
	db = openDatabase( dbName, '1.0', 'Envastats database for ' + username, 5 * 1024 * 1024 );
	db.transaction(function (tx)
	{
		//tx.executeSql( 'DROP TABLE IF EXISTS `statements`');
		tx.executeSql( 'CREATE TABLE IF NOT EXISTS `statements` (' +
		'  `date` DATETIME NOT NULL ,' +
		'  `type` TINYINT(1) NOT NULL ,' +
		'  `detail` VARCHAR(255) NULL ,' +
		'  `item` INT NOT NULL ,' +
		'  `amount` FLOAT(7,2) NOT NULL ,' +
		'  `rate` FLOAT(4,1) NULL ,' +
		'  `price` FLOAT(7,2) NULL,' +
		'  `amount_converted` FLOAT(7,2) NOT NULL )' );

	}, function ( e )
	{
		// Couldn't create table
		screens.initStatus.removeClass(' envastats-loading' ).text( chrome.i18n.getMessage( 'errorInitDatabase' ) );
		console.log( 'Error while initializing database: ' + e.message );

	}, function ()
	{
		// Startup process
		refreshStatementsTable( screens.initStatus, function()
		{
			finalizeInitialStatementRefresh( buildWidgetsScreen );

		}, false );
	});




	/*************************************************************************/
	/*                             Core functions                            */
	/*************************************************************************/

	/**
	 * Update dates 'now' and 'today'
	 * @return void
	 */
	function updateCoreDates()
	{
		// Update now
		nowLocal   = new Date();
		now.setTime( nowLocal.getTime() + timeOffset );
		library.options.now.change();

		// Update today
		if ( today.getDate() !== now.getDate() )
		{
			// Reset day of moth to prevent auto correction
			today.setDate( 1 );

			// Copy from now
			today.setFullYear( now.getFullYear() );
			today.setMonth( now.getMonth() );
			today.setDate( now.getDate() );
			library.options.today.change();
		}

		// Next update
		setTimeout( updateCoreDates, 60000 - ( ( nowLocal.getSeconds() * 1000 ) + nowLocal.getMilliseconds() ) );
	}
	setTimeout( updateCoreDates, 60000 - ( ( nowLocal.getSeconds() * 1000 ) + nowLocal.getMilliseconds() ) );

	/**
	 * Get the database code of a statement type
	 * @param string type the type name
	 * @return int the internal code for the type
	 */
	function getStatementTypeCode( type )
	{
		return envato.statement.types[ type ] || 0;
	}

	/**
	 * Finalize database initial update
	 * @param function callback a function to call when complete
	 * @return void
	 */
	function finalizeInitialStatementRefresh( callback )
	{
		var currency = library.options.currency.get(),
			lastFinalizedMonth = library.options.lastFinalizedMonth.get(),
			month, year;

		// Message
		screens.initStatus.text( 'Retrieving first sale...' );

		// Update first sale date
		db.transaction( function (tx)
		{
			tx.executeSql( 'SELECT strftime(\'%d\', `date`) AS `day`,' +
							' strftime(\'%m\', `date`) AS `month`,' +
							' strftime(\'%Y\', `date`) AS `year`' +
							' FROM `statements` WHERE `type`=? ORDER BY `date` ASC LIMIT 1',
							[ getStatementTypeCode( 'sale' ) ],
							function ( tx, result )
			{
				var row;

				// If found
				if ( result.rows.length > 0 )
				{
					// Convert to date
					row = result.rows.item( 0 );
					firstSale = new Date( parseInt( row.year, 10 ), parseInt( row.month, 10 ) - 1, parseInt( row.day, 10 ) );

					// Log
					console.log( 'First sale date: ' + displayDate( firstSale, 'longDate' ) );
				}
				else
				{
					// Log
					console.log( 'No sales yet' );
				}

				// Callback
				if ( callback )
				{
					callback();
				}

			}, function ( tx, e )
			{
				console.log( 'Error while retrieving first sale date: ' + e.message );

				// Callback
				if ( callback )
				{
					callback();
				}
			} );

		} );
	}

	/**
	 * Build the widgets screen
	 * @return void
	 */
	function buildWidgetsScreen()
	{
			// Prevent refresh of the screen before it is built
		var ready = false;

			// Function to refresh wrapper size and controls block position
			refreshScreen = function()
			{
				if ( ready )
				{
					// Refresh screen size
					updateScreenHeight( screens.widgets );
				}
			};

		// Add widgets block
		screens.widgets = addScreen( 'widgets' );
		showScreen( screens.widgets );

		// Build widgets
		buildWidgets( $( '<div></div>').appendTo( screens.widgets ), refreshScreen );

		// Controls block
		screens.widgetsControls = $( '<div class="envastats-options"></div>' ).appendTo( screens.widgets );

		// Build options
		buildControls( screens.widgetsControls );

		// Set as ready
		ready = true;

		// First refresh
		refreshScreen();
	}

	/**
	 * Build all widgets
	 * @param jQuery screenDiv the block in which to build the widgets
	 * @param function onResize a callback to fire for each resize
	 * @return void
	 */
	function buildWidgets( screenDiv, onResize )
	{
		// Get configuration
		var userWidgets = library.options.widgets.get();

		// Main widget screen
		widgets.main = new WidgetsScreen( screenDiv, onResize )

		// Create rows
		$.each( userWidgets, function ( rowName, rowConfig )
		{
			// Object
			var row = new WidgetRow( widgets.main.newChildDiv(), rowConfig.height || 100 );

			// Register
			widgets.main.addRow( rowName, row );

			// Create widgets
			$.each( rowConfig.widgets, function ( widgetName, widgetConfig )
			{
				var div = row.newChildDiv(),
					column, widget;

				// Position
				if ( widgetConfig.position )
				{
					div.css( widgetConfig.position );
				}

				// Type
				switch ( widgetConfig.type )
				{
					case 'column':
						// Object
						column = new WidgetColumn( div );

						// Register
						row.addWidget( widgetName, column );

						// Inner widgets
						$.each( widgetConfig.widgets, function ( subWidgetName, subWidgetConfig )
						{
							column.addWidget( subWidgetName, new Widget( column.newChildDiv(), library.widgets[ subWidgetConfig.controller ], subWidgetConfig.options ) );
						} );
						break;

					default:
						// Object
						widget = new Widget( div, library.widgets[ widgetConfig.controller ], widgetConfig.options );

						// Register
						row.addWidget( widgetName, widget );
						break;
				}
			} );
		} );
	}

	/**
	 * Build controls block
	 * @param jQuery blockControls the block in which to build the widgets
	 * @return void
	 */
	function buildControls( blockControls )
	{
		$.each( library.controls, function( name, control )
		{
			control.build( blockControls );
		} );
	}

	/**
	 * Add a main screen
	 * @param string className the screen's class name, which will be prefixed by 'envastats-'
	 * @return jQuery the new block object
	 */
	function addScreen( className )
	{
		return $( '<div class="envastats-screen envastats-' + className + '"></div>' ).appendTo( wrapper );
	}

	/**
	 * Show the given screen: slide it in position, set the correct block height
	 * @param jQuery screen the block to show
	 * @return void
	 */
	function showScreen( screen )
	{
		// Hide previous screen
		if ( screens.current && screens.current[ 0 ] !== screen[ 0 ] )
		{
			screens.current.animate( {
				left: '-100%'
			}, function ()
			{
				// Reset position
				$( this ).css( 'left', '' );
			} );
		}

		// Show
		screen.animate( {
			left: '0%'
		} );

		// Set correct height
		wrapper.animate( {
			height: screen.outerHeight() + 'px'
		} );

		// Store as current
		screens.current = screen;
	}

	/**
	 * Update the main div height to fit the given screen, if it is the current one
	 * @param jQuery screen the block whose height to use
	 * @return void
	 */
	function updateScreenHeight( screen )
	{
		// If active screen
		if ( screens.current && screens.current[ 0 ] === screen[ 0 ] )
		{
			// Set correct height
			wrapper.stop( true ).animate( {
				height: screen.outerHeight() + 'px'
			} );
		}
	}

	/**
	 * Refresh statement table
	 * @param jQuery status the element to show progress status
	 * @param function callback a function to call when complete
	 * @param boolean reload use true to empty database and reload it
	 * @return boolean
	 */
	function refreshStatementsTable( status, callback, reload )
	{
		var lastMonth, lastYear, params,
			nbStatements, currentStatement = 1,
			nextMonth;

		// If reloading
		if ( reload )
		{
			// Empty database
			db.transaction( function (tx)
			{
				tx.executeSql( 'DELETE FROM `statements`', [], function ( tx, result )
				{
					console.log( 'Statement table has been truncated' );

				}, function ( tx, e )
				{
					console.log( 'Error while truncating statements table: ' + e.message );
				} );

			} );

			// Clear cache
			setStoredValue( 'last-month', false );
			setStoredValue( 'last-year', false );
		}

		// When shall we start loading
		lastMonth = getStoredValue( 'last-month', false );
		lastYear = getStoredValue( 'last-year', false );

		// If never refresh (or reload is true), parse first available statement date
		if ( lastMonth === false || !lastYear )
		{
			// Defaults
			lastMonth = now.getMonth() + 1;
			lastYear = now.getFullYear();

			// Past statements links
			$( '.sidebar-s .feature-list a[href^="/user/' + username + '/statement?month="]' ).first().each( function ()
			{
				params = /month=([0-9]+)&year=([0-9]+)$/.exec( this.href );
				if ( params )
				{
					lastMonth = parseInt( params[ 1 ], 10 );
					lastYear = parseInt( params[ 2 ], 10 );
				}
			} );
		}

		// Number or statements files to load, including current one (always refreshed)
		nbStatements = Math.max( 1, ( lastYear != now.getFullYear() ) ? ( 13 - lastMonth ) + ( ( now.getFullYear() - lastYear - 1 ) * 12 ) + now.getMonth() + 1 : now.getMonth() + 2 - lastMonth );

		// Function to parse months one after the other
		nextMonth = function ()
		{
			// Increment month
			++lastMonth;
			if ( lastMonth > 12 )
			{
				lastMonth = 1;
				++lastYear;
			}
			++currentStatement;

			// If all files have been loaded
			if ( ( lastYear === now.getFullYear() && lastMonth > now.getMonth() + 1 ) || lastYear > now.getFullYear() )
			{
				// Cache
				setStoredValue( 'last-month', now.getMonth() + 1 );
				setStoredValue( 'last-year', now.getFullYear() );

				// Force refresh of loaded requests
				$.each( library.requests, function ( name, request )
				{
					if ( request.isLoaded() )
					{
						request.load();
					}
				} );

				// Refresh statements rate
				finalizeStatementRefresh( callback );

				// Stop
				return;
			}

			// Display status
			if ( status )
			{
				status.text( chrome.i18n.getMessage( 'loadingStatementArchiveStatus', [
					currentStatement,
					nbStatements
				] ) );
			}

			// Load next
			refreshMonthStatement( lastMonth, lastYear, nextMonth );
		};

		// Display status
		if ( status )
		{
			status.text( chrome.i18n.getMessage( 'loadingStatementArchiveStatus', [
				currentStatement,
				nbStatements
			] ) );
		}

		// First call
		refreshMonthStatement( lastMonth, lastYear, nextMonth );
	}

	/**
	 * Load the statement CSV file for a month and inject into database
	 * @param int month the month (1-12)
	 * @param int year the year
	 * @param function callback a function to call when complete
	 * @return void
	 */
	function refreshMonthStatement( month, year, callback )
	{
		var url = '/user/' + username + '/download_statement_as_csv?month=' + month + '&year=' + year;

		// Log
		console.log( 'Refreshing ' + month + '/' + year );
		console.log( '* Downloading statements: ' + url );

		// Load content
		$.ajax( url, {
			dataType: 'text',
			success: function ( data )
			{
				var headers, columns = {}, i;

				console.log( '* File downloaded' );

				// Parse
				data = $.csv()( data );

				// Headers
				headers = data.shift();

				// Index columns
				for ( i = 0; i < headers.length; ++i )
				{
					columns[ headers[i].toLowerCase().replace( /[^a-zA-Z0-9]+/, '_' ) ] = i;
				}

				// Drop existing entries in database
				db.transaction( function ( tx )
				{
					tx.executeSql( 'DELETE FROM `statements` WHERE strftime(\'%m-%Y\', `date`)=?', [ padDateValue( month ) + '-' + year ], function ( tx, result )
					{
						console.log( '* Clear month statements: removed ' + result.rowsAffected + ' row(s)' );

						// Insert rows
						db.transaction( function ( tx )
						{
							$.each( data, function ( i )
							{
								// Amount
								var amount = parseFloat( this[ columns.amount ] ) || 0;

								// Insert
								tx.executeSql( 'INSERT INTO `statements` (`date`, `type`, `detail`, `item`, `amount`, `rate`, `price`, `amount_converted`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
									this[ columns.date ].substr( 0, 19 ),
									getStatementTypeCode( this[ columns.type ] ),
									( this[ columns.type ] === 'sale' ) ? '' : this[ columns.detail ],
									this[ columns.item_id ],
									amount,
									parseFloat( this[ columns.rate ] ) || 0,
									parseFloat( this[ columns.price ] ) || 0,
									amount
								], function( tx, result ) {}, function ( tx, e )
								{
									console.log( '* Error while adding new statement: ' + e.message );
								} );

							} );

						}, function( e )
						{
							// Callback
							if ( callback )
							{
								callback.call();
							}

						}, function()
						{
							console.log( '* Done, added ' + data.length + ' statements for ' + month + '/' + year );

							// Callback
							if ( callback )
							{
								callback.call();
							}
						} );

					} );

				}, function ( e )
				{
					console.log( '* Error while clearing month statements: ' + e.message );

					// Callback
					if ( callback )
					{
						callback.call();
					}
				} );
			},
			error: function ()
			{
				console.log( '* Error while downloading file, aborting refresh for ' + month + '/' + year );

				// Callback
				if ( callback )
				{
					callback.call();
				}
			}
		} );
	}

	/**
	 * Finalize statements refresh: apply currency rate to newly added sales, and refresh rate for recent ones
	 * @param function callback a function to call when complete
	 * @return void
	 */
	function finalizeStatementRefresh( callback )
	{
		var currencyAlt = library.options.currencyAlt.get(),
			lastFinalizedMonth;

		// If using alternative currency
		if ( currencyAlt )
		{
			// Message
			screens.initStatus.text( chrome.i18n.getMessage( 'refreshingCurrencyRates' ) );
			console.log( 'Refreshing currency rates...' );

			// If already partialy updated
			lastFinalizedMonth = library.options.lastFinalizedMonth.get();
			if ( lastFinalizedMonth )
			{
				// Refresh from last finalized month + 1
				month = lastFinalizedMonth.month + 1;
				year = lastFinalizedMonth.year;
				if ( month > 12 )
				{
					month = 1;
					++year;
				}
				updateDatabaseConvertedAmounts( currencyAlt, year, month, callback );
			}
			else
			{
				// Whole database refresh
				setNewAltCurrency( currency, callback );
			}
		}
		else
		{
			// Callback
			if ( callback )
			{
				callback();
			}
		}
	}

	/**
	 * Get a stored value, using an object to preserve types
	 * @param string name the name of the value
	 * @param mixed def the default value if not set
	 * @return mixed the value, or def
	 */
	function getStoredValue( name, def )
	{
		// Values storage object
		if ( !storage )
		{
			storage = getStoredObject( 'storage', {} );
		}

		return ( storage[ name ] === null || storage[ name ] === undefined ) ? def : storage[ name ];
	}

	/**
	 * Set a stored value, using an object to preserve types
	 * @param string name the name of the value
	 * @param mixed value the value
	 * @return void
	 */
	function setStoredValue( name, value )
	{
		// Values storage object
		if ( !storage )
		{
			storage = getStoredObject( 'storage', {} );
		}

		storage[ name ] = value;
		setStoredObject( 'storage', storage );
	}

	/**
	 * Get a stored object value
	 * @param string name the name of the value
	 * @param object def the default value if not set
	 * @return object the value, or def
	 */
	function getStoredObject( name, def )
	{
		var value = localStorage.getItem( storageName + name );
		return ( value === null || value === undefined || value === 'undefined' ) ? def : JSON.parse( value );
	}

	/**
	 * Set a stored object value
	 * @param string name the name of the value
	 * @param object value the value
	 * @return void
	 */
	function setStoredObject( name, value )
	{
		localStorage.setItem( storageName + name, JSON.stringify( value ) );
	}

	/**
	 * Reset all stored values
	 * @return void
	 */
	function resetStorage()
	{
		// Empty storage
		setStoredObject( 'options', {} );
		setStoredObject( 'ressources', {} );
		setStoredObject( 'rate', {} );
		setStoredObject( 'stoage', {} );

		// Reset options
		$.each( library.options, function( name, object )
		{
			object.reset();
		} );
	}

	/**
	 * Display an amount in the given currency, using corresponding l10n
	 * @param string currency the currency to use
	 * @param float amount the amount to display
	 * @param int decimals number of decimals to display (default: 0)
	 * @return string the formated amount
	 */
	function displayCurrencyAmount( currency, amount, decimals )
	{
		var symbol = rates.symbols[ currency ] || currency,
			amount = number_format( amount, decimals || 0 );

		return __l10n( 'currency_display' ).replace( '{currency}', currency )
										  .replace( '{symbol}', symbol )
										  .replace( '{amount}', amount );
	}

	/**
	 * Display an date, using corresponding l10n
	 * @param Date date the date object
	 * @param string format name of the date format (default: 'default')
	 * @return string the formated date string
	 */
	function displayDate( date, format )
	{
			// Format
		var formats = __l10n( 'date_formats' ),
			template = ( format && formats[ format ] ) ? formats[ format ] : formats[ 'default' ],

			// Date parts
			day = date.getDay(),
			dayofmonth = date.getDate(),
			month = date.getMonth(),
			hours = date.getHours(),

			// Final string
			output = '',

			// Work vars
			i, chr;

		// Parse template
		for ( i = 0; i < template.length; ++i )
		{
			chr = template.substr( i, 1 );
			switch (chr)
			{
				// Escaped char
				case '\\':
					output += template.substr( i + 1, 1 );
					++i;
					break;

				// Day
				case 'd':	output += padDateValue( dayofmonth );							break;			// Day of the month, 2 digits with leading zeros
				case 'D':	output += __i18n( 'daysShort' )[ day ];							break;			// A textual representation of a day, three letters
				case 'j':	output += dayofmonth;											break;			// Day of the month without leading zeros
				case 'l':	output += __i18n( 'days' )[ day ];								break;			// A full textual representation of the day of the week
				case 'N':	output += day || 7;												break;			// ISO-8601 numeric representation of the day of the week (added in PHP 5.1.0)
				case 'w':	output += day;													break;			// Numeric representation of the day of the week
				case 'z':	output += getDayOfYear( date );									break;			// The day of the year (starting from 0)

				// Week
				case 'W':	output += getWeekNumber( date );								break;			// ISO-8601 week number of year, weeks starting on Monday (added in PHP 4.1.0)

				// Month
				case 'F':	output += __i18n( 'months' )[ month ];							break;			// A full textual representation of a month, such as January or March
				case 'm':	output += padDateValue( month + 1 );							break;			// Numeric representation of a month, with leading zeros
				case 'M':	output += __i18n( 'monthsShort' )[ month ];						break;			// A short textual representation of a month, three letters
				case 'n':	output += ( month + 1 );										break;			// Numeric representation of a month, without leading zeros

				// Year
				case 'Y':	output += date.getFullYear();									break;			// A full numeric representation of a year, 4 digits
				case 'y':	output += date.getFullYear().substr( 2, 2 );					break;			// A two digit representation of a year

				// Time
				case 'a':	output += ( hours < 12 ) ? 'am' : 'pm';							break;			// Lowercase Ante meridiem and Post meridiem
				case 'A':	output += ( hours < 12 ) ? 'AM' : 'PM';							break;			// Uppercase Ante meridiem and Post meridiem
				case 'g':	output += ( hours < 12 ) ? hours : hours - 12;					break;			// 12-hour format of an hour without leading zeros
				case 'G':	output += hours;												break;			// 24-hour format of an hour without leading zeros
				case 'h':	output += padDateValue( ( hours < 12 ) ? hours : hours - 12 );	break;			// 12-hour format of an hour with leading zeros
				case 'H':	output += padDateValue( hours );								break;			// 24-hour format of an hour with leading zeros
				case 'i':	output += padDateValue( date.getMinutes() );					break;			// Minutes with leading zeros
				case 's':	output += padDateValue( date.getSeconds() );					break;			// Seconds, with leading zeros

				default:	output += chr;			break;
			}
		}

		return output;
	}



	/*************************************************************************/
	/*                             Control class                             */
	/*************************************************************************/

	/**
	 * Constructor
	 * @param string markup the control's markup
	 * @param function init the function to init
	 * @param object children list of sub-elements
	 */
	var Control = function ( markup, init, children )
	{
		var cache, i;

		// Store
		this.markup = markup;
		this.init = init;
		this.children = children || {};
		this.settings = {
			prependChildren: false
		};

		// Init
		this.element = false;
		this.childrenWrapper = false;
	};

	/**
	 * Build the control
	 * @param jQuery wrapper the element in which to build the control
	 * @param boolean prepend true if the control must use prepend instead of append
	 * @return void
	 */
	Control.prototype.build = function ( wrapper, prepend )
	{
		var self = this;

		// Create element
		this.element = $( this.markup )[ prepend ? 'prependTo' : 'appendTo' ]( wrapper );
		this.childrenWrapper = this.element;

		// Init
		this.init.call( this );

		// Build chidren
		$.each( this.children, function( name, control )
		{
			control.build( self.childrenWrapper, self.settings.prependChildren );
		} );
	};



	/*************************************************************************/
	/*                        Publisher pattern class                        */
	/*************************************************************************/

	var Publisher = function()
	{
		// Init
		this.subscribers = [];
	};

	/**
	 * Add a subscriber object
	 * @param object object any object with the required callback methods
	 * @return void
	 */
	Publisher.prototype.addSubscriber = function ( object )
	{
		// Add
		this.subscribers.push( object );
	};

	/**
	 * Remove a subscriber object
	 * @param object object the object to remove
	 * @return void
	 */
	Publisher.prototype.removeSubscriber = function ( object )
	{
		var i;
		for ( i = 0; i < this.subscribers.length; ++i )
		{
			if ( this.subscribers[ i ] === object )
			{
				this.subscribers.splice( i, 1 );
				--i;
			}
		}
	};



	/*************************************************************************/
	/*                              Option class                             */
	/*************************************************************************/

	/**
	 * Constructor
	 * Subscribers must provide one method: onOptionChange( name, value )
	 * @param string name the options's name
	 * @param mixed def the option's default value
	 * @param boolean disableCache use true to disable caching for this option
	 */
	var Option = function ( name, def, disableCache )
	{
		var cache;

		// Store
		this.name = name;
		this.value = def;
		this.def = def;
		this.disableCache = disableCache;

		// Init
		this.subscribers = [];

		// Check cache
		if ( !this.disableCache )
		{
			cache = this.checkCache();
			if ( cache )
			{
				this.value = cache.value;
			}
		}
	};
	Option.prototype = new Publisher();

	/**
	 * Check if the option has already been defined
	 * @return object the option's value (an object with one index: value), or false if not defined yet
	 */
	Option.prototype.checkCache = function ()
	{
		// Retrieve cache
		var cache = getStoredObject( 'options', {} ),
			value = cache[ this.name ];

		return value ? value : false;
	};

	/**
	 * Reset option to its default value
	 * @return void
	 */
	Option.prototype.reset = function ()
	{
		this.set( this.def );
	};

	/**
	 * Get the option's value
	 * @return mixed the option's value
	 */
	Option.prototype.get = function ()
	{
		return this.value;
	};

	/**
	 * Set the option's value
	 * @param mixed value the new value
	 * @param boolean forceChange use true to trigger the change listeners even if the value did not change (default: false)
	 * @return void
	 */
	Option.prototype.set = function ( value, forceChange )
	{
		var cache;

		// If different
		if ( value !== this.value )
		{
			// Store
			this.value = value;

			// Update cache
			if ( !this.disableCache )
			{
				cache = getStoredObject( 'options', {} );
				if ( this.value === this.def )
				{
					delete cache[ this.name ];
				}
				else
				{
					cache[ this.name ] = {
						value: value
					};
				}
				setStoredObject( 'options', cache );
			}

			// Notify subscribers
			this.change();
		}
		else if ( forceChange )
		{
			// Forced update
			this.change();
		}
	};

	/**
	 * Trigger the change callback on all subscribers
	 * @return void
	 */
	Option.prototype.change = function ( value )
	{
		var option = this;

		// Notify subscribers
		$.each( this.subscribers, function ( i, object )
		{
			object.onOptionChange( option.name, option.value );
		} );
	};



	/*************************************************************************/
	/*                            Ressource class                            */
	/*************************************************************************/

	/**
	 * Constructor
	 * Subscribers must provide two methods: onRessourceLoad( name ) and onRessourceFail( name )
	 * @param string name the ressource's name
	 * @param string|function url the url to call to get the ressource (just the filename if in api), or a function that will return the url
	 * @param int the expiration timeout of the cache for the ressource in milliseconds
	 */
	var Ressource = function ( name, url, expiration )
	{
		var cache;

		// Store
		this.name = name;
		this.url = ( typeof url === 'string' && url.indexOf( '://' ) === -1 ) ? envato.api.url + url : url;
		this.expiration = expiration;

		// Init
		this.data = null;
		this.date = null;
		this.loading = false;
		this.failures = 0;
		this.failed = false;
		this.subscribers = [];

		// Check cache
		cache = this.checkCache();
		if ( cache )
		{
			this.data = cache.data;
			this.date = cache.date;
		}
	};
	Ressource.prototype = new Publisher();

	/**
	 * Check if the ressource has been cached
	 * @return object the cached ressource (an object with two indexes: date and data), or false if not cached or expired
	 */
	Ressource.prototype.checkCache = function ()
	{
		// Retrieve cache
		var cache = getStoredObject( 'ressources', {} ),
			cached = cache[ this.name ],
			date;

		// If stored
		if ( cached )
		{
			// Check expiration date
			date = new Date();
			if ( cached.date + this.expiration > date.getTime() )
			{
				return cached;
			}
			else
			{
				// Remove cache
				delete cache[ this.name ];
				setStoredObject( 'ressources', cache );
			}
		}

		// Not available
		return false;
	};

	/**
	 * Get the ressource data. If not ready, start loading.
	 * @return object the ressource data, or false if not loaded yet or expired
	 */
	Ressource.prototype.get = function ()
	{
		var date;

		// If set
		if ( this.data )
		{
			// Check expiration date
			date = new Date();
			if ( this.date + this.expiration > date.getTime() )
			{
				return this.data;
			}
			else
			{
				// Clear
				this.data = null;
				this.date = null;
			}
		}

		// Start loading
		this.load();

		// Not ready
		return false;
	};

	/**
	 * Check if the ressource has already been loaded
	 * @return boolean true if loaded, else false
	 */
	Ressource.prototype.isLoaded = function ()
	{
		return ( this.data !== null );
	};

	/**
	 * Start loading the ressource
	 * @return void
	 */
	Ressource.prototype.load = function ()
	{
		var url;

		// If not already loading or failed
		if ( !this.loading && !this.failed )
		{
			// Final url
			url = ( typeof this.url === 'function' ) ? this.url.call( this ) : this.url;

			// Start loading
			this.loading = true;
			console.log( '§ Loading ressource ' + url );

			// Request
			$.ajax({
				url: url,
				dataType: 'json',
				data: '',
				context: this,
				error: function ( jqXHR, textStatus, errorThrown )
				{
					var ressource = this;

					// End loading
					this.loading = false;
					console.log( '§ Error while loading ressource ' + url );

					// Count failures
					++this.failures;

					// If under the maximum number of tries, start again
					if ( this.failures < 3 )
					{
						this.load();
					}
					else
					{
						// Mark as permanent fail
						this.failed = true;

						// Notify subscribers
						$.each( this.subscribers, function ( i, object )
						{
							object.onRessourceFail( ressource.name );
						} );
					}
				},
				success: function ( data, textStatus, jqXHR )
				{
					var ressource = this,
						date = new Date(),
						cache = getStoredObject( 'ressources', {} );

					// End loading
					this.loading = false;
					console.log( '§ Ressource loaded: ' + url );

					// Store
					this.data = data;
					this.date = date.getTime();

					// Update cache
					cache[ this.name ] = {
						data: this.data,
						date: this.date
					};
					setStoredObject( 'ressources', cache );

					// Reset failure count
					this.failed = false;
					this.failures = 0;

					// Notify subscribers
					$.each( this.subscribers, function ( i, object )
					{
						object.onRessourceLoad( ressource.name );
					} );
				}
			});
		}
	};

	/**
	 * Function to get the ressource corresponding to an item
	 * @param int id the item id
	 * @return Ressource the item's ressource
	 */
	function getItemRessource( id )
	{
		// If not created yet
		if ( !library.ressources.items[ id ] )
		{
			library.ressources.items[ id ] = new Ressource( 'Item ' + id, 'item:' + id + '.json', 7 * 86400000 );
		}

		return library.ressources.items[ id ];
	}



	/*************************************************************************/
	/*                             Request class                             */
	/*************************************************************************/

	/**
	 * Constructor
	 * Subscribers must provide two methods: onRequestLoad( name ) and onRequestFail( name )
	 * @param string name the request's name
	 * @param string|function request the request to call, or a function that will return the request
	 * @param array params list of parameters for the request
	 * @param array options list of options the request is bound to
	 */
	var Request = function ( name, request, params, options )
	{
		var cache, i;

		// Store
		this.name = name;
		this.request = request;
		this.params = params || [];
		this.options = options || [];

		// Init
		this.data = null;
		this.failed = false;
		this.subscribers = [];
		this.timeout = false;

		// Registrer options
		for ( i = 0; i < this.options.length; ++i )
		{
			this.options[ i ].addSubscriber( this );
		}
	};
	Request.prototype = new Publisher();

	/**
	 * List of awaiting requests
	 * @var array
	 */
	Request.prototype.queue = [];

	/**
	 * Callback when an option changes
	 * @param string name of the option
	 * @param mixed value the new value
	 * @return void
	 */
	Request.prototype.onOptionChange = function ( name, value )
	{
		// Clear data to force refresh
		this.data = null;
		this.failed = false;

		// Reload with delay (to account form ultiple options changes)
		this.delayLoad();
	};

	/**
	 * Get the request data. If not ready, start loading.
	 * @return object the ressource data, or false if not loaded yet or expired
	 */
	Request.prototype.get = function ()
	{
		// If set
		if ( this.data )
		{
			return this.data;
		}

		// Start loading
		this.load();

		// Not ready
		return false;
	};

	/**
	 * Check if the request has already been loaded
	 * @return boolean true if loaded, else false
	 */
	Request.prototype.isLoaded = function ()
	{
		return ( this.data !== null );
	};

	/**
	 * Delay load of request, to account for multiple changes
	 * @return void
	 */
	Request.prototype.delayLoad = function ()
	{
		var instance = this;

		// If not delayed yet
		if ( !this.timeout )
		{
			this.timeout = setTimeout( function()
			{
				// Clear
				instance.timeout = false;

				// Load
				instance.load();

			}, 20 );
		}
	};

	/**
	 * Start loading the request
	 * @return void
	 */
	Request.prototype.load = function ()
	{
		// If not already loading or failed
		if ( !this.loading && !this.failed )
		{
			// Queue
			Request.prototype.queue.push( this );

			// Start loading
			this.loading = true;

			// If first request, start loading
			if ( Request.prototype.queue.length === 1 )
			{
				this.loadNext();
			}
		}
	};

	/**
	 * Start loading the next queued request
	 * @return void
	 */
	Request.prototype.loadNext = function ()
	{
		var instance, request, params, options = {}, i;

		// If there are no more requests in the queue
		if ( Request.prototype.queue.length === 0 )
		{
			return;
		}

		// Get next
		instance = Request.prototype.queue[ 0 ];

		// Options for functions
		if ( typeof instance.request === 'function' || typeof instance.params === 'function' )
		{
			for ( i = 0; i < instance.options.length; ++i )
			{
				options[ instance.options[ i ].name ] = instance.options[ i ].get();
			}
		}

		// Final url and params
		request = ( typeof instance.request === 'function' ) ? instance.request.call( instance, options ) : instance.request;
		params = ( typeof instance.params === 'function' ) ? instance.params.call( instance, options ) : instance.params;

		// Request
		db.transaction( function ( tx )
		{
			tx.executeSql( request, params, function ( tx, results )
			{
				// End loading
				instance.loading = false;

				// Store
				instance.data = results;

				// Reset failure status
				instance.failed = false;

				// Notify subscribers
				$.each( instance.subscribers, function ( i, object )
				{
					object.onRequestLoad( instance.name );
				} );

				// Clear queue
				Request.prototype.queue.shift();

				// Next request
				instance.loadNext();

			}, function ( tx, e )
			{
				// End loading
				instance.loading = false;

				// Mark as permanent fail
				instance.failed = true;

				// Log
				console.log( 'Error while executing request ' + instance.name + ': ' + e.message );

				// Notify subscribers
				$.each( instance.subscribers, function ( i, object )
				{
					object.onRequestFail( instance.name );
				} );

				// Clear queue
				Request.prototype.queue.shift();

				// Next request
				instance.loadNext();
			} );
		} );
	};



	/*************************************************************************/
	/*                             Widgets screen                            */
	/*************************************************************************/

	/**
	 * Constructor
	 * @param jQuery div the target div of the screen
	 * @param function onResize a callback to fire for each resize
	 */
	var WidgetsScreen = function ( div, onResize )
	{
		var cache, i;

		// Store
		this.div = div.addClass( 'envastats-widgets-screen' );
		this.onResize = onResize;

		// Init
		this.height = 0;
		this.rows = {};
	};

	/**
	 * Get a new child div for a WidgetRow
	 * @return jQuery the new div
	 */
	WidgetsScreen.prototype.newChildDiv = function()
	{
		return $( '<div></div>' ).appendTo( this.div );
	};

	/**
	 * Add a new WidgetRow
	 * @param string name the name of the widget
	 * @param WidgetRow row the new row
	 * @return void
	 */
	WidgetsScreen.prototype.addRow = function( name, row )
	{
		// Register
		this.rows[ name ] = row;

		// Refresh positions
		this.refreshPositions();
	};

	/**
	 * Remove a WidgetRow
	 * @param string name the name of the row to remove
	 * @return void
	 */
	WidgetsScreen.prototype.removeRow = function( name )
	{
		if ( this.rows[ name ] )
		{
			// Remove
			delete this.rows[ name ];

			// Refresh positions
			this.refreshPositions();
		}
	};

	/**
	 * Update rows positions and overall size
	 * @return void
	 */
	WidgetsScreen.prototype.refreshPositions = function()
	{
		var height = 0;

		// Position rows
		$.each( this.rows, function( name, row )
		{
			// Margin
			if ( height > 0 )
			{
				height += 30;
			}

			// Position
			row.setPosition( height );

			// Total height
			height += row.height;
		} );

		// Set screen size
		this.height = height;
		this.div.height( height );

		// Trigger listener
		if ( this.onResize )
		{
			this.onResize.call( this );
		}
	};



	/*************************************************************************/
	/*                              Widgets Row                              */
	/*************************************************************************/

	/**
	 * Constructor
	 * @param jQuery div the target div of the row
	 * @param int height height of the row
	 */
	var WidgetRow = function ( div, height )
	{
		var cache, i;

		// Store
		this.height = height || 100;
		this.div = div.addClass( 'envastats-widgets-row' ).height( this.height );

		// Init
		this.widgets = {};
	};

	/**
	 * Get a new child div for a Widget
	 * @return jQuery the new div
	 */
	WidgetRow.prototype.newChildDiv = function()
	{
		return $( '<div></div>' ).appendTo( this.div );
	};

	/**
	 * Set the row vertical position in the parent screen
	 * @param int position the new position
	 * @return void
	 */
	WidgetRow.prototype.setPosition = function( position )
	{
		this.div.css( 'top', position + 'px' );
	};

	/**
	 * Add a new Widget
	 * @param string name the name of the widget
	 * @param Widget widget the new widget
	 * @return void
	 */
	WidgetRow.prototype.addWidget = function( name, widget )
	{
		this.widgets[ name ] = widget;
	};

	/**
	 * Remove a Widget
	 * @param string name the name of the row to remove
	 * @return void
	 */
	WidgetRow.prototype.removeWidget = function( name )
	{
		if ( this.widgets[ name ] )
		{
			delete this.widgets[ name ];
		}
	};



	/*************************************************************************/
	/*                             Widgets Column                            */
	/*************************************************************************/

	/**
	 * Constructor
	 * @param jQuery div the target div of the column
	 */
	var WidgetColumn = function ( div )
	{
		var cache, i;

		// Store
		this.div = div.addClass( 'envastats-widgets-column' );

		// Init
		this.widgets = {};
	};

	/**
	 * Get a new child div for a Widget
	 * @return jQuery the new div
	 */
	WidgetColumn.prototype.newChildDiv = function()
	{
		return $( '<div></div>' ).appendTo( this.div );
	};

	/**
	 * Add a new Widget
	 * @param string name the name of the widget
	 * @param Widget widget the new widget
	 * @return void
	 */
	WidgetColumn.prototype.addWidget = function( name, widget )
	{
		this.widgets[ name ] = widget;
	};

	/**
	 * Remove a Widget
	 * @param string name the name of the row to remove
	 * @return void
	 */
	WidgetColumn.prototype.removeWidget = function( name )
	{
		if ( this.widgets[ name ] )
		{
			delete this.widgets[ name ];
		}
	};



	/*************************************************************************/
	/*                             Widget class                              */
	/*************************************************************************/

	/**
	 * Constructor
	 * @param jQuery div the target div
	 * @param WidgetController controller the widget controller
	 * @param object options the options
	 */
	var Widget = function ( div, controller, options )
	{
		var i;

		// Store
		this.div = div.addClass( 'envastats-widget' );
		this.controller = controller;
		this.options = options || {};

		// Inner DOM elements
		this.rebuildContentDiv();

		// Init
		this.vars = {};
		this.loadingMessage = false;
		this.errorMessage = false;
		this.failed = false;
		this.failedRessource = false;
		this.failedRequest = false;
		this.timeout = false;

		// Controller init
		if ( this.controller.init )
		{
			this.controller.init.call( this, this.options );
		}

		// Gather ressources
		this.library = {
			options		: ( typeof this.controller.options === 'function' )		? this.controller.options( this.options )		: this.controller.options,
			ressources	: ( typeof this.controller.ressources === 'function' )	? this.controller.ressources( this.options )	: this.controller.ressources,
			requests	: ( typeof this.controller.requests === 'function' )	? this.controller.requests( this.options )		: this.controller.requests
		};

		// Registrer options
		for ( i = 0; i < this.library.options.length; ++i )
		{
			this.library.options[ i ].addSubscriber( this );
		}

		// Registrer ressources
		for ( i = 0; i < this.library.ressources.length; ++i )
		{
			this.library.ressources[ i ].addSubscriber( this );
		}

		// Registrer requests
		for ( i = 0; i < this.library.requests.length; ++i )
		{
			this.library.requests[ i ].addSubscriber( this );
		}

		// Create loading status
		this.loadingMessage = $( '<div class="envastats-loading"></div>' ).appendTo( this.div );

		// First try to build widget
		this.build();
	};

	/**
	 * Delay build of widget, to account for multiple changes
	 * @return void
	 */
	Widget.prototype.delayBuild = function ()
	{
		var instance = this;

		// If not delayed yet
		if ( !this.timeout )
		{
			this.timeout = setTimeout( function()
			{
				// Clear
				instance.timeout = false;

				// Build
				instance.build();

			}, 20 );
		}
	};

	/**
	 * Build the widget
	 * @return void
	 */
	Widget.prototype.build = function ()
	{
		var message, i,
		ressources = {},
		requests = {},
		options = {},
		data;

		// If error
		if ( this.failed )
		{
			// Remove loading message if set
			if ( this.loadingMessage )
			{
				this.loadingMessage.remove();
				this.loadingMessage = false;
			}

			// Error description
			message = chrome.i18n.getMessage( 'errorWhileLoadingType', [
				this.failedRessource ? this.failedRessource : this.failedRequest
			] );

			// Show message
			if ( !this.errorMessage )
			{
				this.errorMessage = $( '<div class="envastats-error">' + message + '</div>' ).appendTo( this.div );
			}
			else
			{
				this.errorMessage.text( message );
			}

			// Do not go further
			return;
		}
		else
		{
			// Remove error if set
			if ( this.errorMessage )
			{
				this.errorMessage.fadeAndRemove();
				this.errorMessage = false;
			}
		}

		// Check currency
		if ( rates.updating && $.inArray( library.options.currency, this.library.options ) > -1 )
		{
			// Display message
			if ( this.loadingMessage )
			{
				this.loadingMessage.text( chrome.i18n.getMessage( 'currencyConversion' ) );
			}

			// Wait
			return;
		}

		// Check ressources
		for ( i = 0; i < this.library.ressources.length; ++i )
		{
			// Retrieve data
			data = this.library.ressources[ i ].get();

			// If not ready yet
			if ( data === false )
			{
				// Display message
				if ( this.loadingMessage )
				{
					this.loadingMessage.text( chrome.i18n.getMessage( 'loadingStatus', [
						i + 1,
						this.library.ressources.length + this.library.requests.length
					] ) );
				}

				// Wait
				return;
			}

			// Store
			ressources[ this.library.ressources[ i ].name ] = data;
		}

		// Check requests
		for ( i = 0; i < this.library.requests.length; ++i )
		{
			// Retrieve data
			data = this.library.requests[ i ].get();

			// If not ready yet
			if ( data === false )
			{
				// Display message
				if ( this.loadingMessage )
				{
					this.loadingMessage.text( chrome.i18n.getMessage( 'loadingStatus', [
						this.library.ressources.length + i + 1,
						this.library.ressources.length + this.library.requests.length
					] ) );
				}

				// Wait
				return;
			}

			// Store
			requests[ this.library.requests[ i ].name ] = data;
		}

		// Options
		for ( i = 0; i < this.library.options.length; ++i )
		{
			options[ this.library.options[ i ].name ] = this.library.options[ i ].get();
		}

		// Remove loading message
		if ( this.loadingMessage )
		{
			this.loadingMessage.text( chrome.i18n.getMessage( 'ready' ) ).fadeAndRemove();
			this.loadingMessage = false;
		}

		// All done, build it!
		this.controller.build.call( this, ressources, requests, $.extend( options, this.options ) );
	};

	/**
	 * Empty the widget div
	 * @return void
	 */
	Widget.prototype.emptyDiv = function ()
	{
		// Remove
		if ( this.content )
		{
			this.content.remove();
			this.content = false;
		}

		if ( this.loadingMessage )
		{
			this.div.children().not( this.loadingMessage ).remove();
			this.loadingMessage.text( chrome.i18n.getMessage( 'ready' ) ).fadeAndRemove();
			this.loadingMessage = false;
		}
		else
		{
			this.div.empty();
		}

		// Inner DOM elements
		this.rebuildContentDiv();
	};

	/**
	 * Rebuilds the content div
	 * @return void
	 */
	Widget.prototype.rebuildContentDiv = function ()
	{
		// Remove
		if ( this.content )
		{
			this.content.remove();
		}

		// Rebuild
		this.content = $( '<div class="envastats-widget-content"></div>' ).appendTo( this.div );
	};

	/**
	 * Defines the widget title
	 * @param string title the title (may be HTML)
	 * @param boolean atBottom use true to display the title at bottom (default: false)
	 * @return void
	 */
	Widget.prototype.setTitle = function( title, atBottom )
	{
		// Create block if required
		if ( !this.title )
		{
			this.title = $( '<div class="envastats-widget-title"></div>' ).prependTo( this.div );
		}

		// Position
		this.title[ atBottom ? 'addClass' : 'removeClass' ]( 'envastats-widget-title-bottom' );

		// Set text
		this.title.html( '<span>' + title + '</span>' );
	};

	/**
	 * Callback when an option changes
	 * @param string name of the option
	 * @param mixed value the new value
	 * @return void
	 */
	Widget.prototype.onOptionChange = function ( name, value )
	{
		// Only update if option was not overriden
		if ( !this.options.hasOwnProperty( name ) )
		{
			this.delayBuild();
		}
	};

	/**
	 * Callback when a ressource is loaded
	 * @param string name of the ressource
	 * @return void
	 */
	Widget.prototype.onRessourceLoad = function ( name )
	{
		this.delayBuild();
	};

	/**
	 * Callback when a ressource fails to load
	 * @param string name of the ressource
	 * @return void
	 */
	Widget.prototype.onRessourceFail = function ( name )
	{
		// Store failure
		this.failed = false;
		this.failedRessource = name;

		// Build to show error
		this.build();
	};

	/**
	 * Callback when a request is loaded
	 * @param string name of the request
	 * @return void
	 */
	Widget.prototype.onRequestLoad = function ( name )
	{
		this.delayBuild();
	};

	/**
	 * Callback when a request fails to load
	 * @param string name of the request
	 * @return void
	 */
	Widget.prototype.onRequestFail = function ( name )
	{
		// Store failure
		this.failed = false;
		this.failedRessource = name;

		// Build to show error
		this.build();
	};



	/*************************************************************************/
	/*                        Widget controller class                         */
	/*************************************************************************/

	/**
	 * Constructor
	 * @param object settings the controller settings
	 */
	var WidgetController = function ( settings )
	{
		// Store
		this.options    = settings.options		|| [];
		this.ressources = settings.ressources	|| [];
		this.requests   = settings.requests		|| [];
		this.init       = settings.init			|| function() {};
		this.build      = settings.build		|| function() {};
	};

	/**
	 * Check if the controller use the given option
	 * @param Option option the option
	 * @return boolean true if the controller uses it, else false
	 */
	WidgetController.prototype.useOption = function ( option )
	{
		return ( $.inArray( option, this.options ) > -1 );
	};

	/**
	 * Check if the controller use the given ressource
	 * @param Ressource ressource the ressource
	 * @return boolean true if the controller uses it, else false
	 */
	WidgetController.prototype.useRessource = function ( ressource )
	{
		return ( $.inArray( ressource, this.ressources ) > -1 );
	};

	/**
	 * Check if the controller use the given request
	 * @param Request request the request
	 * @return boolean true if the controller uses it, else false
	 */
	WidgetController.prototype.useRequest = function ( request )
	{
		return ( $.inArray( request, this.requests ) > -1 );
	};



	/*************************************************************************/
	/*                           CallbackList class                           */
	/*************************************************************************/

	/**
	 * Constructor
	 */
	var CallbackList = function()
	{
		this.list = new Array();
	};

	/**
	 * Add a callback to the object
	 * @var function callback the callbac kto add
	 * @return void
	 */
	CallbackList.prototype.add = function( callback )
	{
		this.list.push( callback );
	};

	/**
	 * Call all the callbacks in the list
	 * @param mixed param any number of params
	 * @return void
	 */
	CallbackList.prototype.call = function()
	{
		var i;
		for ( i = 0; i < this.list.length; ++i )
		{
			this.list[ i ].apply( window, arguments );
		}
	};



	/*************************************************************************/
	/*                            Define controls                            */
	/*************************************************************************/

	$.extend( library.controls, {

		// Left controls block
		leftControls:			new Control( '<div class="envastats-options-left"></div>',
								function()
								{
									this.settings.prependChildren = true;
								},
								{

				currency:				new Control( '<span class="envastats-currencies"></span>',
										function()
										{
												// Target element
											var element = this.element,

												// Function to refresh content
												build = function( forceChoice )
												{
													var currency = library.options.currency.get(),
														currencyAlt = library.options.currencyAlt.get(),
														defaultClass, altClass, altCurrency,
														select, code, button;

													// Prepare
													element.empty();

													// If key is active
													if ( library.options.oerKey.get() )
													{
														// If alternative currency is set
														if ( currencyAlt && !forceChoice )
														{
															// Current
															if ( currency === envato.currency )
															{
																defaultClass = ' envastats-active-switch';
																altClass = '';
																altCurrency = currencyAlt;
															}
															else
															{
																defaultClass = '';
																altClass = ' envastats-active-switch';
																altCurrency = currency;
															}

															// Create buttons
															element.append( '<span class="envastats-switch-option first' + defaultClass + '" id="envastats-default-currency">' + envato.currency + '</span>' +
																			'<span class="envastats-switch-option last' + altClass + '" id="envastats-alt-currency">' + altCurrency + '</span>' +
																			'<i class="envastats-switch-link" id="envastats-change-currency">Change</i>' );
														}
														else
														{
															// Create select
															select = $( '<select></select>' ).appendTo( element );

															// Add options
															for ( code in rates.currencies )
															{
																if ( rates.currencies.hasOwnProperty( code ) && code !== envato.currency )
																{
																	select.append( '<option value="' + code + '">' + rates.currencies[ code ] + '</option>' );
																}
															}

															// Save button
															$( '<button type="button">' + chrome.i18n.getMessage( 'ok' ) + '</button>' ).appendTo( element ).click( function()
															{
																var currency = select.val();

																// Start process
																setNewAltCurrency( currency, function()
																{
																	// Set value to trigger updates
																	library.options.currency.set( currency );

																	// Back to normal state
																	build();
																} );

																// Display message
																element.empty().text( chrome.i18n.getMessage( 'updatingDatabase' ) );
															} );

															// Cancel button if relevant
															if ( forceChoice )
															{
																$( '<span class="envastats-currency-link">' + chrome.i18n.getMessage( 'cancel' ) + '</span>' ).appendTo( element ).click( function()
																{
																	// Back to normal state
																	build();
																} );
															}
														}
													}
													else
													{
														button = $( '<button type="button">' + chrome.i18n.getMessage( 'changeCurrency' ) + '</button>' ).appendTo( element ).envastatsMenuTooltip(

															'<p>' + chrome.i18n.getMessage( 'instructionOERAccount', [
																'<a href="https://openexchangerates.org/signup/free" target="_blank">',
																'</a>'
															] ) + '</p>' +
															'<input type="text" style="width: 180px"> <button type="button">' + chrome.i18n.getMessage( 'save' ) + '</button>', {

															classes: [ 'large-padding' ],
															onShow: function()
															{
																var tooltip = $( this ),
																	input = tooltip.find( 'input' ),
																	save = tooltip.find( 'button' );

																save.click( function()
																{
																	var key = $.trim( input.val() );
																	if ( key.length > 0 )
																	{
																		button.removeEnvastatsTooltip();
																		library.options.oerKey.set( key );
																	}
																	else
																	{
																		alert( chrome.i18n.getMessage( 'pleaseEnterOERAPIKey' ) );
																	}
																} );
															}

														} );
													}
												},

												// Options subscriber
												subscriber = {
													onOptionChange: function( name, value )
													{
														build();
													}
												};

											// First build
											build();

											// Watch for clicks
											$( document ).on( 'click', '#envastats-default-currency', function()
											{
												library.options.currency.set( envato.currency );
											} )
											.on( 'click', '#envastats-alt-currency', function()
											{
												library.options.currency.set( library.options.currencyAlt.get() );
											} )
											.on( 'click', '#envastats-change-currency', function()
											{
												build( true );
											} );

											// Watch for changes
											library.options.oerKey.addSubscriber( subscriber );
											library.options.currency.addSubscriber( subscriber );
											library.options.currencyAlt.addSubscriber( subscriber );
										} )

								} ),

		// Right controls block
		rightControls:			new Control( '<div class="envastats-options-right"></div>',
								function()
								{
									this.settings.prependChildren = true;
								},
								{

				settings:				new Control( '<button type="button"><img src="' + chrome.extension.getURL( 'img/settings.png' ) + '" width="16" height="16"></button>',
										function()
										{
											var element = this.element;

											// Menu
											element.envastatsMenuTooltip(

												'<button type="button" style="width: 160px" id="envastats-reset-settings">' + chrome.i18n.getMessage( 'resetSettings' ) + '</button><br>' +
												'<button type="button" style="width: 160px" id="envastats-rebuild-database">' + chrome.i18n.getMessage( 'rebuildDatabase' ) + '</button>', {

												classes: [ 'buttons-tooltip' ]

											} );

											// Buttons actions
											$( document ).on( 'click', '#envastats-reset-settings', function()
											{
												// Hide tooltip
												element.removeEnvastatsTooltip();

												// Reset
												resetStorage();

												// Confirmation
												alert( chrome.i18n.getMessage( 'settingsHaveBeenReset' ) );
											} )
											.on( 'click', '#envastats-rebuild-database', function()
											{
												// Hide tooltip
												element.removeEnvastatsTooltip();

												// Show init screen
												showScreen( screens.init );

												// Update database
												refreshStatementsTable( screens.initStatus, function()
												{
													// Bring back widgets
													showScreen( screens.widgets );

												}, true );
											} )
										} ),

				refresh:				new Control( '<button type="button">' + chrome.i18n.getMessage( 'refresh' ) + '</button>',
										function()
										{
											this.element.click( function( event )
											{
												refreshStatementsTable();
											} );
										} ),

				autoRefresh:			new Control( '<span><label for="envastats-auto-refresh">' + chrome.i18n.getMessage( 'autoRefresh' ) + '</label> <input type="checkbox" id="envastats-auto-refresh" value="1"></span>',
										function()
										{
												// Target element
											var element = this.element,

												// Checkbox
												checkbox = element.find( ':checkbox' ),

												// Timeout of update function
												timeout = false,

												// Timestamp of next refresh
												next = false,

												// Prevent circular references
												internal = false,

												// Function to trigger refresh
												refresh = function()
												{
													var date = new Date(),
														delay = library.options.autoRefreshDelay.get();

													// Log
													console.log( '[' + padDateValue( nowLocal.getHours() ) + ':' + padDateValue( nowLocal.getMinutes() ) + '] Refresh data' );

													// Start refresh
													refreshStatementsTable( /*status, callback, reload*/ );

													// Next call
													timeout = setTimeout( refresh, delay );
													next = date.getTime() + delay;
												},

												// Function to start auto-refresh
												startRefresh = function()
												{
													var date = new Date(),
														delay = library.options.autoRefreshDelay.get();

													// Do not start if already running
													if ( timeout )
													{
														return;
													}

													console.log( 'Start auto-refresh' );
													timeout = setTimeout( refresh, delay );
													next = date.getTime() + delay;
												},

												// Function to stop auto-refresh
												stopRefresh = function()
												{
													// If running
													if ( timeout )
													{
														console.log( 'Stop auto-refresh' );
														clearTimeout( timeout );
														timeout = false;
														next = false;
													}
												},

												// Tooltip refresh timeout
												tooltipTimeout = false,

												// Function to get tooltip content
												getTooltipContent = function()
												{
													var date, diff, minutes, seconds;

													if ( next )
													{
														date = new Date();
														diff = Math.floor( ( next - date.getTime() ) / 1000 );
														minutes = Math.floor( diff / 60 );
														seconds = diff - ( minutes * 60 );

														return padDateValue( minutes ) + ':' + padDateValue( seconds );
													}
													else
													{
														return chrome.i18n.getMessage( 'disabled' );
													}
												};

											// Initial state
											if ( library.options.autoRefresh.get() )
											{
												// Check
												checkbox.prop( 'checked', true );

												// Start timeout
												startRefresh();
											}

											// Watch for changes
											library.options.autoRefresh.addSubscriber( {

												onOptionChange: function( name, value )
												{
													// Update checkbox
													if ( !internal )
													{
														checkbox.prop( 'checked', !!value );
													}

													// Start/stop timeout
													if ( value )
													{
														startRefresh();
													}
													else
													{
														stopRefresh();
													}
												}

											} );

											// Watch checkbox
											checkbox.change( function( event )
											{
												internal = true;
												library.options.autoRefresh.set( checkbox.prop( 'checked' ) );
												internal = false;
											} );

											// Timing tooltip
											element.on( 'mouseenter', function()
											{
												element.envastatsTooltip( getTooltipContent(), {
													removeOnMouseleave:	true,
													onShow:				function()
													{
														tooltipTimeout = setTimeout( function()
														{
															element.envastatsTooltip( getTooltipContent() );

														}, 1000 );
													},
													onRemove:			function()
													{
														clearTimeout( tooltipTimeout );
													}
												} );
											} );
										} )

								} ),

		range:				new Control( '<span></span>',
								function()
								{
										// Target element
									var element = this.element,

										// Active configuration
										useChartRange = library.options.useChartRange.get(),

										// Buttons
										range30Days = $( '<span class="envastats-switch-option first' +
														( ( useChartRange && library.options.chartRange.get() == 30 ) ? ' envastats-active-switch' : '' ) +
														'">' + chrome.i18n.getMessage( '30days' ) + '</span>' ).appendTo( element ),
										range6Months = $( '<span class="envastats-switch-option' +
														( ( useChartRange && library.options.chartRange.get() == 183 ) ? ' envastats-active-switch' : '' ) +
														'">' + chrome.i18n.getMessage( '6months' ) + '</span>' ).appendTo( element ),
										rangeAll = $( '<span class="envastats-switch-option last' + ( !useChartRange ? ' envastats-active-switch' : '' ) + '">' + chrome.i18n.getMessage( 'allTime' ) + '</span>' ).appendTo( element ),

										// Listener to update on options change
										listener = {
											onOptionChange: function( name, value )
											{
												range30Days[ ( value && library.options.chartRange.get() == 30 ) ? 'addClass' : 'removeClass' ]( 'envastats-active-switch' );
												range6Months[ ( value && library.options.chartRange.get() == 183 ) ? 'addClass' : 'removeClass' ]( 'envastats-active-switch' );
												rangeAll[ value ? 'removeClass' : 'addClass' ]( 'envastats-active-switch' );
											}
										};

									// Watch for clicks
									range30Days.click( function()
									{
										library.options.chartRange.set( 30 );
										library.options.useChartRange.set( true );
									} );
									range6Months.click( function()
									{
										library.options.chartRange.set( 183 );
										library.options.useChartRange.set( true );
									} );

									rangeAll.click( function()
									{
										library.options.useChartRange.set( false );
									} );

									// Watch for changes
									library.options.chartRange.addSubscriber( listener );
									library.options.useChartRange.addSubscriber( listener );
								} )

	} );



	/*************************************************************************/
	/*                             Define options                            */
	/*************************************************************************/

	$.extend( library.options, {

		/*
		 * Note: passing true as the third option disable caching for the option
		 */

		// Dates
		now:					new Option( 'now',					now,	true ),
		today:					new Option( 'today',				today,	true ),

		// Time ranges in days
		chartRange:				new Option( 'chartRange',			30 ),
		useChartRange:			new Option( 'useChartRange',		true ),

		// Currency
		currency:				new Option( 'currency',				envato.currency ),	// Currently displayed currency
		currencyAlt:			new Option( 'currencyAlt',			false ),			// Alternative currency
		currencyCurrentRate:	new Option( 'currencyCurrentRate',	false,	true ),
		oerKey:					new Option( 'oerKey',				false ),
		currencyConvertDay:		new Option( 'currencyConvertDay',	15 ),				// Day of month at which the conversion takes place
		lastFinalizedMonth:		new Option( 'lastFinalizedMonth',	false ),			// Last month where the rate has been definitively set

		// Configuration
		autoRefresh:			new Option( 'autoRefresh',			false ),
		autoRefreshDelay:		new Option( 'autoRefreshDelay',		15 * 60 * 1000 ),

		// Widgets
		widgets:				new Option( 'widgets',				{

									lastDays: {

										height: 220,
										widgets: {
											sales:	{ controller: 'chartSales',		position: { left: 0, width: '700px' } },
											items:	{ controller: 'chartDispatch',	position: { left: '700px', right: 0 } }
										}

									},

									numbers: {

										height: 188,
										widgets: {
											totals:	{ type: 'column',	position: { left: 0, width: '100px' }, widgets: {
														totalSales:		{ controller: 'totalSales' },
														monthSales:		{ controller: 'totalSales', options: { mode: 'month' } },
														weekSales:		{ controller: 'totalSales', options: { mode: 'week' } }
													} },
											sold:	{ type: 'column',	position: { left: '120px', width: '155px' }, widgets: {
														totalAmount:	{ controller: 'totalAmount' },
														monthAmount:	{ controller: 'totalAmount', options: { mode: 'month' } },
														weekAmount:		{ controller: 'totalAmount', options: { mode: 'week' } }
													} },
											earned:	{ type: 'column',	position: { left: '295px', width: '190px' }, widgets: {
														totalEarnings:	{ controller: 'totalEarnings' },
														monthEarnings:	{ controller: 'totalEarnings', options: { mode: 'month' } },
														weekEarnings:	{ controller: 'totalEarnings', options: { mode: 'week' } }
													} },
											refcut:	{ type: 'column',	position: { left: '505px', width: '150px' }, widgets: {
														totalRefCut:	{ controller: 'totalRefCut' },
														monthRefCut:	{ controller: 'totalRefCut', options: { mode: 'month' } },
														weekRefCut:		{ controller: 'totalRefCut', options: { mode: 'week' } }
													} },
											badges:	{ type: 'column',	position: { right: 0, width: '214px' }, widgets: {
														paw:			{ controller: 'progressLevel', options: { levels: 'paws' } },
														elite:			{ controller: 'progressLevel', options: { levels: 'elite' } }
													} }
										}

									},

									globalStats: {

										height: 150,
										widgets: {
											week:	{ controller: 'chartWeekSales',	position: { width: '260px' } },
											hours:	{ controller: 'chartHourSales',	position: { left: '280px', right: 0 } }
										}

									},

								} )

	} );



	/*************************************************************************/
	/*                     Define ressources and requests                    */
	/*************************************************************************/

	$.extend( library.requests, {

		// Global

		globalStats:	new Request( 'globalStats',		'SELECT COUNT(*) AS `total`, SUM(`amount`) AS `totalAmount`, ' +
														'SUM(`amount_converted`) AS `totalAmountConverted`, SUM(`price`) AS `totalPrice` ' +
														'FROM `statements` WHERE `type`=?',
														[ getStatementTypeCode( 'sale' ) ],
														[ library.options.currency ] ),

		globalRefCut:	new Request( 'globalRefCut',	'SELECT COUNT(*) AS `total`, SUM(`amount`) AS `totalAmount`, ' +
														'SUM(`amount_converted`) AS `totalAmountConverted` ' +
														'FROM `statements` WHERE `type`=?',
														[ getStatementTypeCode( 'referral_cut' ) ],
														[ library.options.currency ] ),


		// Monthly

		monthStats:		new Request( 'monthStats',		'SELECT COUNT(*) AS `total`, SUM(`amount`) AS `totalAmount`, ' +
														'SUM(`amount_converted`) AS `totalAmountConverted`, SUM(`price`) AS `totalPrice` ' +
														'FROM `statements` WHERE `type`=? AND `date`>=?',
														function( options )
														{
															return [ getStatementTypeCode( 'sale' ), displayDate( getFirstDayOfMonth( options.today ), 'sqlDatetime' ) ];
														},
														[ library.options.currency, library.options.today ] ),

		monthRefCut:	new Request( 'monthRefCut',		'SELECT COUNT(*) AS `total`, SUM(`amount`) AS `totalAmount`, ' +
														'SUM(`amount_converted`) AS `totalAmountConverted` ' +
														'FROM `statements` WHERE `type`=? AND `date`>=?',
														function( options )
														{
															return [ getStatementTypeCode( 'referral_cut' ), displayDate( getFirstDayOfMonth( options.today ), 'sqlDatetime' ) ];
														},
														[ library.options.currency, library.options.today ] ),


		// Weekly

		weekStats:		new Request( 'weekStats',		'SELECT COUNT(*) AS `total`, SUM(`amount`) AS `totalAmount`, ' +
														'SUM(`amount_converted`) AS `totalAmountConverted`, SUM(`price`) AS `totalPrice` ' +
														'FROM `statements` WHERE `type`=? AND `date`>=?',
														function( options )
														{
															return [ getStatementTypeCode( 'sale' ), displayDate( getFirstDayOfWeek( options.today ), 'sqlDatetime' ) ];
														},
														[ library.options.currency, library.options.today ] ),

		weekRefCut:		new Request( 'weekRefCut',		'SELECT COUNT(*) AS `total`, SUM(`amount`) AS `totalAmount`, ' +
														'SUM(`amount_converted`) AS `totalAmountConverted` ' +
														'FROM `statements` WHERE `type`=? AND `date`>=?',
														function( options )
														{
															return [ getStatementTypeCode( 'referral_cut' ), displayDate( getFirstDayOfWeek( options.today ), 'sqlDatetime' ) ];
														},
														[ library.options.currency, library.options.today ] ),

		// Charts requests

		chartSales:		new Request( 'chartSales',		function( options )
														{
															var parts = getChartRangeRequestParts( options ),
																format;

															// Precision
															if ( parts.days < 50 )
															{
																format = '%Y-%m-%d';
															}
															else if ( parts.days < 250 )
															{
																format = '%Y-%W';
															}
															else
															{
																format = '%Y-%m';
															}

															return 'SELECT strftime(\'' + format + '\', `date`) AS `date`, COUNT(*) AS `sales`, ' +
																	'SUM(`amount`) AS `totalAmount`, SUM(`amount_converted`) AS `totalAmountConverted` FROM `statements` ' +
																	'WHERE `type`=?' + parts.where +
																	'GROUP BY strftime(\'' + format + '\', `date`)'
														},
														getChartRangeRequestParams,
														[ library.options.today, library.options.chartRange, library.options.useChartRange, library.options.currency ] ),

		chartTotal:		new Request( 'chartTotal',		function( options )
														{
															var parts = getChartRangeRequestParts( options );

															return 'SELECT COUNT(*) AS `total`, SUM(`amount`) AS `totalAmount`, ' +
																	'SUM(`amount_converted`) AS `totalAmountConverted`, SUM(`price`) AS `totalPrice` ' +
																	'FROM `statements` WHERE `type`=?' + parts.where;
														},
														getChartRangeRequestParams,
														[ library.options.today, library.options.chartRange, library.options.useChartRange, library.options.currency ] ),

		chartDispatch:	new Request( 'chartDispatch',	function( options )
														{
															var parts = getChartRangeRequestParts( options );

															return 'SELECT `item`, COUNT(*) AS `sales`, SUM(`amount`) AS `totalAmount`, ' +
																	'SUM(`amount_converted`) AS `totalAmountConverted` FROM `statements` ' +
																	'WHERE `type`=?' + parts.where + ' GROUP BY `item` LIMIT 15';
														},
														getChartRangeRequestParams,
														[ library.options.today, library.options.chartRange, library.options.useChartRange, library.options.currency ] ),

		chartWeekSales:	new Request( 'chartWeekSales',	function( options )
														{
															var parts = getChartRangeRequestParts( options );

															return 'SELECT COUNT(*) AS `sales`, strftime(\'%w\', `date`) AS `day` FROM `statements` ' +
																	'WHERE `type`=?' + parts.where + ' GROUP BY strftime(\'%w\', `date`)';
														},
														getChartRangeRequestParams,
														[ library.options.today, library.options.chartRange, library.options.useChartRange, library.options.currency ] ),

		chartHourSales:	new Request( 'chartHourSales',	function( options )
														{
															var parts = getChartRangeRequestParts( options );

															return 'SELECT COUNT(*) AS `sales`, strftime(\'%H\', `date`) AS `hour` FROM `statements` ' +
																	'WHERE `type`=?' + parts.where + ' GROUP BY strftime(\'%H\', `date`)';
														},
														getChartRangeRequestParams,
														[ library.options.today, library.options.chartRange, library.options.useChartRange, library.options.currency ] )

	} );

	// Generic function to get parts ot the request string depending on the desired chart range
	function getChartRangeRequestParts( options )
	{
		var where, days;

		// Are we limiting results?
		if ( options.useChartRange || !firstSale )
		{
			where = ' AND `date`>=?';
			days = options.chartRange;
		}
		else
		{
			where = '';
			days = Math.ceil( ( now.getTime() - firstSale.getTime() ) / 86400000 );
		}

		return {
			where: where,
			days: days
		};
	}

	// Generic function to return requests arguments depending on the desired chart range
	function getChartRangeRequestParams( options )
	{
		var startDate, startString;

		if ( options.useChartRange || !firstSale )
		{
			// Relative dates
			startDate = offsetDate( options.today, -( options.chartRange - 1 ) );

			return [ getStatementTypeCode( 'sale' ), displayDate( startDate, 'sqlDatetime' ) ];
		}
		else
		{
			return [ getStatementTypeCode( 'sale' ) ];
		}
	}



	/*************************************************************************/
	/*                     Define widgets configurations                     */
	/*************************************************************************/

	$.extend( library.widgets, {

		chartSales: new WidgetController( {
			'options':		[ library.options.today, library.options.chartRange, library.options.useChartRange, library.options.currency ],
			'ressources':	[],
			'requests':		[ library.requests.chartSales ],
			'build':		function ( ressources, requests, options )
							{
									// Processed data
								var data = indexResultSet( requests.chartSales, 'date', 'date' ),

									// Chart labels
									labels = [],

									// Values
									sales  = [],
									amount = [],

									// Use USD amount
									useUSD = isCurrencyUSD(),

									// Tooltips
									tooltips = [],

									// Number of days displayed
									days = ( options.useChartRange || !firstSale ) ? options.chartRange : Math.ceil( ( now.getTime() - firstSale.getTime() ) / 86400000 ),

									// Start date
									startDate = offsetDate( options.today, 1 - days ),
									currentDate = startDate,

									// Functions to retrieve next date index and next date
									nextIndex, nextDate,

									// Work vars
									dateIndex, dateDisplay, row, amountValue;

								// Current range status
								if ( this.vars.chartRange == undefined )
								{
									this.vars.chartRange = options.chartRange;
								}
								if ( this.vars.useChartRange == undefined )
								{
									this.vars.useChartRange = options.useChartRange;
								}

								// Rebuild content div if range changed
								if ( this.vars.chartRange !== options.chartRange || this.vars.useChartRange !== options.useChartRange )
								{
									// Rebuild div (chart lib has issue when using changing number of points)
									this.rebuildContentDiv();

									// Store new status
									this.vars.chartRange = options.chartRange;
									this.vars.useChartRange = options.useChartRange;
								}

								// Mode
								if ( days < 50 )
								{
									nextIndex = function()
									{
										var index;

										// If done
										if ( currentDate > now )
										{
											return false;
										}

										return 'date' + currentDate.getFullYear() + '-' + padDateValue( currentDate.getMonth() + 1 ) + '-' + padDateValue( currentDate.getDate() );
									}
									nextDate = function()
									{
										currentDate = offsetDate( currentDate, 1 );
									}
								}
								else if ( days < 250 )
								{
									nextIndex = function()
									{
										var index,
											week = getWeekNumber( currentDate );

										// If done
										if ( week > getWeekNumber( now ) )
										{
											return false;
										}

										return 'date' + currentDate.getFullYear() + '-' + week;
									}
									nextDate = function()
									{
										currentDate = offsetDate( currentDate, 7 );
									}
								}
								else
								{
									nextIndex = function()
									{
										var index,
											month = currentDate.getMonth(),
											year = currentDate.getFullYear();

										// If done
										if ( ( year === now.getFullYear() && month > now.getMonth() ) || year > now.getFullYear() )
										{
											return false;
										}

										return 'date' + year + '-' + padDateValue( month + 1 );
									}
									nextDate = function()
									{
										var month = currentDate.getMonth(),
											year = currentDate.getFullYear();

										++month;
										if ( month > 11 )
										{
											month = 0;
											++year;
										}
										currentDate = new Date( year, month, 1, 0, 0, 0 );
									}
								}

								// Process
								while ( dateIndex = nextIndex() )
								{
									// X labels
									if ( days < 50 )
									{
										labels.push( currentDate.getDate() );
										dateDisplay = displayDate( currentDate, 'longDate' );
									}
									else if ( days < 250 )
									{
										labels.push( getWeekNumber( currentDate ) );
										dateDisplay = displayDate( currentDate, 'week' );
									}
									else if ( days < 450 )
									{
										labels.push( __i18n( 'months' )[ currentDate.getMonth() ] );
										dateDisplay = displayDate( currentDate, 'month' );
									}
									else
									{
										labels.push( ( currentDate.getMonth() === 0 ) ? currentDate.getFullYear() : '' );
										dateDisplay = displayDate( currentDate, 'month' );
									}

									// Data
									row = data[ dateIndex ];
									if ( row )
									{
										sales.push( row.sales );
										amountValue = useUSD ? row.totalAmount : row.totalAmountConverted;
										amount.push( amountValue );

										// Tooltips
										tooltips.push( dateDisplay + '<br>' +
														chrome.i18n.getMessage( ( row.sales > 1 ) ? 'numberSalesPlural' : 'numberSalesSingular', [
															number_format( row.sales, 0 )
														] ) + ', ' + displayCurrencyAmount( options.currency, amountValue ) );
									}
									else
									{
										// Empty
										sales.push( 0 );
										amount.push( 0 );

										// Tooltips
										tooltips.push( dateDisplay + '<br>' +
														chrome.i18n.getMessage( 'noActivity' ) );
									}

									// Next date
									nextDate();
								}

								// Build chart
								this.content.chart( {
									template: 'envastats_sales',
									labels:   labels,
									tooltips: tooltips,
									values: {
										serie1: sales,
										serie2: amount
									}
								} );
							}
		} ),

		chartDispatch: new WidgetController( {
			'options':		[ library.options.currency ],
			'ressources':	[],
			'requests':		[ library.requests.chartDispatch, library.requests.chartTotal ],
			'init':			function ( options )
							{
								this.vars.items = {};
								this.setTitle( chrome.i18n.getMessage( 'salesDistributionByItem' ), true );
							},
			'build':		function ( ressources, requests, options )
							{
									// Total sales and earnings
								var totalSales = 0,
									totalEarnings = 0,

									// Values
									sales = [],
									earnings = [],

									// Tooltips
									tooltipsSales = [],
									tooltipsEarnings = [],

									// Colors
									props = [],
									colors = [ '#00ccff', '#0099ff', '#0033ff', '#9900ff',
												'#cc00ff', '#ff00cc', '#ff0000', '#ff6600',
												'#ff9900', '#ffff00', '#ccff00', '#33ff00',
												'#00ffcc', '#808080' ],

									// Use USD amount
									useUSD = isCurrencyUSD(),

									// Row of total values
									total = requests.chartTotal.rows.item( 0 ),
									totalAmount = useUSD ? total.totalAmount : total.totalAmountConverted,

									// Work vars
									i, row, itemData, itemName, value;

								// Compute total
								for ( i = 0; i < requests.chartDispatch.rows.length; ++i )
								{
									row = requests.chartDispatch.rows.item( i );
									totalSales += row.sales;
									totalEarnings += useUSD ? row.totalAmount : row.totalAmountConverted;
								}

								// Process
								for ( i = 0; i < requests.chartDispatch.rows.length; ++i )
								{
									row = requests.chartDispatch.rows.item( i );

									// Item data
									if ( !this.vars.items[ 'item' + row.item ] )
									{
										// Get ressource
										this.vars.items[ 'item' + row.item ] = getItemRessource( row.item );

										// Listen
										this.vars.items[ 'item' + row.item ].addSubscriber( this );
									}
									itemData = this.vars.items[ 'item' + row.item ].get();
									itemName = itemData ? itemData.item.item : row.item;
									if ( itemName.length > 30 )
									{
										itemName = itemName.substr( 0, 30 ) + '…';
									}

									// Sales
									sales.push( row.sales );
									tooltipsSales.push( itemName + '<br>' +
														chrome.i18n.getMessage( ( row.sales > 1 ) ? 'numberSalesPlural' : 'numberSalesSingular', [
															number_format( row.sales, 0 )
														] ) + ' - ' + number_format( row.sales / total.total * 100, 1 ) + '%' );

									// Earnings
									value = useUSD ? row.totalAmount : row.totalAmountConverted;
									earnings.push( value );
									tooltipsEarnings.push( itemName + '<br>' +
														displayCurrencyAmount( options.currency, value, 2 ) + ' • ' + number_format( value / totalAmount * 100, 1 ) + '%' );

									// Color
									props.push( {
										plotProps: {
											fill: colors.shift()
										}
									} );
								}

								// Other items
								if ( total.total > totalSales )
								{
									// Sales
									value = total.total - totalSales;
									sales.push( value );
									tooltipsSales.push( chrome.i18n.getMessage( 'otherItems' ) + '<br>' +
														chrome.i18n.getMessage( ( value > 1 ) ? 'numberSalesPlural' : 'numberSalesSingular', [
															number_format( value, 0 )
														] ) + ' - ' + number_format( value / total.total * 100, 1 ) + '%' );

									// Earnings
									value = totalAmount - totalEarnings;
									earnings.push( value );
									tooltipsEarnings.push( row.item + '<br>' +
														displayCurrencyAmount( options.currency, value, 2 ) + ' • ' + number_format( value / totalAmount * 100, 1 ) + '%' );

									// Color
									props.push( {
										plotProps: {
											fill: colors.shift()
										}
									} );
								}

								// Build chart
								this.content.chart( {
									template: 'envastats_radialDispatch',
									values: {
										serie1: sales,
										serie2: earnings
									},
									tooltips: {
										serie1: tooltipsSales,
										serie2: tooltipsEarnings
									},
									defaultSeries: { values: props }
								} );
							}
		} ),

		chartWeekSales: new WidgetController( {
			'options':		[],
			'ressources':	[],
			'requests':		[ library.requests.chartWeekSales ],
			'init':			function( options )
							{
								this.setTitle( chrome.i18n.getMessage( 'salesDistributionByDayOfWeek' ) );
							},
			'build':		function ( ressources, requests, options )
							{
									// Processed data
								var data = indexResultSet( requests.chartWeekSales, 'day', 'day' ),

									// Total sales
									total = 0,

									// Values
									percentages = [],

									// Tooltips
									tooltips = [],

									// Work vars
									i, dayIndex, row, value;

								// Compute total
								for ( i = 0; i < 7; ++i )
								{
									row = data[ 'day' + i ];
									if ( row )
									{
										total += row.sales;
									}
								}

								// Process
								for ( i = 0; i < 7; ++i )
								{
									row = data[ 'day' + i ];

									// Data
									if ( row )
									{
										value = Math.round( ( row.sales / total ) * 1000 ) / 10;
										percentages.push( value );

										// Tooltips
										tooltips.push( __i18n( 'days' )[ i ] + ': ' + value + '%' );
									}
									else
									{
										// Empty
										percentages.push( 0 );

										// Tooltips
										tooltips.push( __i18n( 'days' )[ i ] + ': ' + '0%' );
									}
								}

								// Build chart
								this.content.chart( {
									template: 'envastats_salesWeek',
									labels:   __i18n( 'daysShort' ),
									tooltips: tooltips,
									values: {
										serie1: percentages
									}
								} );
							}
		} ),

		chartHourSales: new WidgetController( {
			'options':		[],
			'ressources':	[],
			'requests':		[ library.requests.chartHourSales ],
			'init':			function( options )
							{
								this.setTitle( chrome.i18n.getMessage( 'salesDistributionByHourOfDay' ) );
							},
			'build':		function ( ressources, requests, options )
							{
									// Processed data
								var data = indexResultSet( requests.chartHourSales, 'hour', 'hour' ),

									// Total sales
									total = 0,

									// Chart labels
									labels = [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23 ],

									// Values
									percentages = [],

									// Tooltips
									tooltips = [],

									// Hours offset with Envato
									hoursOffset = Math.floor( timeOffset / 3600000 ),

									// Work vars
									i, localHour, row, value;

								// Compute total
								for (var i = 0; i < 24; ++i )
								{
									localHour = ( i - hoursOffset ) % 24;
									if ( localHour < 0 )
									{
										localHour += 24;
									}
									row = data[ 'hour' + padDateValue( localHour ) ];
									if ( row )
									{
										total += row.sales;
									}
								}

								// Process
								for (var i = 0; i < 24; ++i )
								{
									localHour = ( i - hoursOffset ) % 24;
									if ( localHour < 0 )
									{
										localHour += 24;
									}
									row = data[ 'hour' + padDateValue( localHour ) ];

									// Data
									if ( row )
									{
										value = Math.round( ( row.sales / total ) * 1000 ) / 10;
										percentages.push( value );

										// Tooltips
										tooltips.push( padDateValue( i ) + 'H-' + padDateValue( i+1 ) + 'H: ' + value + '%' );
									}
									else
									{
										// Empty
										percentages.push( 0 );

										// Tooltips
										tooltips.push( padDateValue( i ) + 'H-' + padDateValue( i+1 ) + 'H: 0%' );
									}
								}

								// Build chart
								this.content.chart( {
									template: 'envastats_salesHour',
									labels:   labels,
									tooltips: tooltips,
									values: {
										serie1: percentages
									}
								} );
							}
		} ),

		totalSales: new WidgetController( {
			'options':		function( options )
							{
								// Mode
								if ( options.mode === 'week'|| options.mode === 'month' )
								{
									return [ library.options.now ];
								}
								else
								{
									return [];
								}
							},
			'ressources':	[],
			'requests':		function( options )
							{
								// Mode
								if ( options.mode === 'week' )
								{
									return [ library.requests.weekStats ];
								}
								else if ( options.mode === 'month' )
								{
									return [ library.requests.monthStats ];
								}
								else
								{
									return [ library.requests.globalStats ];
								}
							},
			'init':			function( options )
							{
								this.div.addClass( 'envastats-count' );
								if ( options.mode === 'week' || options.mode === 'month' )
								{
									this.div.addClass( 'envastats-compact' );
								}
							},
			'build':		function ( ressources, requests, options )
							{
								var title, request, proportion, estimation = '';

								// Empty target
								this.emptyDiv();

								// Text
								if ( options.mode === 'week' )
								{
									title = chrome.i18n.getMessage( 'thisWeek' );
									request = requests.weekStats;
								}
								else if ( options.mode === 'month' )
								{
									title = chrome.i18n.getMessage( 'thisMonth' );
									request = requests.monthStats;
								}
								else
								{
									title = chrome.i18n.getMessage( 'totalSales' );
									request = requests.globalStats;
								}

								// Final value
								amount = request.rows.item( 0 ).total;

								// Estimation
								if ( options.mode === 'week' )
								{
									proportion = ( 7 * 86400000 ) / Math.max( 1, now.getTime() - getFirstDayOfWeek( now ).getTime() );
									estimation = '<br><span>' + chrome.i18n.getMessage( 'estimationShort' ) + ' ' + number_format( amount * proportion, 0 ) + '</span>';
								}
								else if ( options.mode === 'month' )
								{
									proportion = ( daysInMonth( now ) * 86400000 ) / Math.max( 1, now.getTime() - getFirstDayOfMonth( now ).getTime() );
									estimation = '<br><span>' + chrome.i18n.getMessage( 'estimationShort' ) + ' ' + number_format( amount * proportion, 0 ) + '</span>';
								}

								// Create
								this.content.append( '<h5>' + title + '</h5><p><strong>' + number_format( amount, 0 ) + '</strong>' + estimation + '</p>' );
							}
		} ),

		totalAmount: new WidgetController( {
			'options':		function( options )
							{
								// Mode
								if ( options.mode === 'week'|| options.mode === 'month' )
								{
									return [ library.options.now ];
								}
								else
								{
									return [];
								}
							},
			'ressources':	[],
			'requests':		function( options )
							{
								// Mode
								if ( options.mode === 'week' )
								{
									return [ library.requests.weekStats ];
								}
								else if ( options.mode === 'month' )
								{
									return [ library.requests.monthStats ];
								}
								else
								{
									return [ library.requests.globalStats ];
								}
							},
			'init':			function( options )
							{
								this.div.addClass( 'envastats-count' );
								if ( options.mode === 'week' || options.mode === 'month' )
								{
									this.div.addClass( 'envastats-compact' );
								}
							},
			'build':		function ( ressources, requests, options )
							{
								var title, request, proportion, estimation = '';

								// Empty target
								this.emptyDiv();

								// Text
								if ( options.mode === 'week' )
								{
									title = chrome.i18n.getMessage( 'thisWeek' );
									request = requests.weekStats;
								}
								else if ( options.mode === 'month' )
								{
									title = chrome.i18n.getMessage( 'thisMonth' );
									request = requests.monthStats;
								}
								else
								{
									title = chrome.i18n.getMessage( 'totalAmountSold' );
									request = requests.globalStats;
								}

								// Final value
								amount = request.rows.item( 0 ).totalPrice;

								// Estimation
								if ( options.mode === 'week' )
								{
									proportion = ( 7 * 86400000 ) / Math.max( 1, now.getTime() - getFirstDayOfWeek( now ).getTime() );
									estimation = '<br><span>' + chrome.i18n.getMessage( 'estimationShort' ) + ' ' + displayCurrencyAmount( envato.currency, amount * proportion ) + '</span>';
								}
								else if ( options.mode === 'month' )
								{
									proportion = ( daysInMonth( now ) * 86400000 ) / Math.max( 1, now.getTime() - getFirstDayOfMonth( now ).getTime() );
									estimation = '<br><span>' + chrome.i18n.getMessage( 'estimationShort' ) + ' ' + displayCurrencyAmount( envato.currency, amount * proportion ) + '</span>';
								}

								// Create
								this.content.append( '<h5>' + title + '</h5><p><strong>' + displayCurrencyAmount( envato.currency, request.rows.item( 0 ).totalPrice ) + '</strong>' + estimation + '</p>' );
							}
		} ),

		totalEarnings: new WidgetController( {
			'options':		function( options )
							{
								// Mode
								if ( options.mode === 'week'|| options.mode === 'month' )
								{
									return [ library.options.currency, library.options.now ];
								}
								else
								{
									return [ library.options.currency ];
								}
							},
			'ressources':	[],
			'requests':		function( options )
							{
								// Mode
								if ( options.mode === 'week' )
								{
									return [ library.requests.weekStats ];
								}
								else if ( options.mode === 'month' )
								{
									return [ library.requests.monthStats ];
								}
								else
								{
									return [ library.requests.globalStats ];
								}
							},
			'init':			function( options )
							{
								this.div.addClass( 'envastats-count' );
								if ( options.mode === 'week' || options.mode === 'month' )
								{
									this.div.addClass( 'envastats-compact' );
								}
							},
			'build':		function ( ressources, requests, options )
							{
								var row, amount, title, request, proportion, estimation = '';

								// Empty target
								this.emptyDiv();

								// Text
								if ( options.mode === 'week' )
								{
									title = chrome.i18n.getMessage( 'thisWeek' );
									request = requests.weekStats;
								}
								else if ( options.mode === 'month' )
								{
									title = chrome.i18n.getMessage( 'thisMonth' );
									request = requests.monthStats;
								}
								else
								{
									title = chrome.i18n.getMessage( 'totalEarnings' );
									request = requests.globalStats;
								}

								// Final value
								row = request.rows.item( 0 );
								amount = isCurrencyUSD() ? row.totalAmount : row.totalAmountConverted;

								// Estimation
								if ( options.mode === 'week' )
								{
									proportion = ( 7 * 86400000 ) / Math.max( 1, now.getTime() - getFirstDayOfWeek( now ).getTime() );
									estimation = '<br><span>' + chrome.i18n.getMessage( 'estimationShort' ) + ' ' + displayCurrencyAmount( options.currency, amount * proportion, 2 ) + '</span>';
								}
								else if ( options.mode === 'month' )
								{
									proportion = ( daysInMonth( now ) * 86400000 ) / Math.max( 1, now.getTime() - getFirstDayOfMonth( now ).getTime() );
									estimation = '<br><span>' + chrome.i18n.getMessage( 'estimationShort' ) + ' ' + displayCurrencyAmount( options.currency, amount * proportion, 2 ) + '</span>';
								}

								// Create
								this.content.append( '<h5>' + title + '</h5><p><strong>' + displayCurrencyAmount( options.currency, amount, 2 ) + '</strong>' + estimation + '</p>' );
							}
		} ),

		totalRefCut: new WidgetController( {
			'options':		function( options )
							{
								// Mode
								if ( options.mode === 'week'|| options.mode === 'month' )
								{
									return [ library.options.currency, library.options.now ];
								}
								else
								{
									return [ library.options.currency ];
								}
							},
			'ressources':	[],
			'requests':		function( options )
							{
								// Mode
								if ( options.mode === 'week' )
								{
									return [ library.requests.weekRefCut ];
								}
								else if ( options.mode === 'month' )
								{
									return [ library.requests.monthRefCut ];
								}
								else
								{
									return [ library.requests.globalRefCut ];
								}
							},
			'init':			function( options )
							{
								this.div.addClass( 'envastats-count' );
								if ( options.mode === 'week' || options.mode === 'month' )
								{
									this.div.addClass( 'envastats-compact' );
								}
							},
			'build':		function ( ressources, requests, options )
							{
								var row, amount, request, proportion, estimation = '';

								// Empty target
								this.emptyDiv();

								// Text
								if ( options.mode === 'week' )
								{
									request = requests.weekRefCut;
								}
								else if ( options.mode === 'month' )
								{
									request = requests.monthRefCut;
								}
								else
								{
									request = requests.globalRefCut;
								}

								// Final value
								row = request.rows.item( 0 );
								amount = isCurrencyUSD() ? row.totalAmount : row.totalAmountConverted;

								// Estimation
								if ( options.mode === 'week' )
								{
									proportion = ( 7 * 86400000 ) / Math.max( 1, now.getTime() - getFirstDayOfWeek( now ).getTime() );
									estimation = '<br><span>' + chrome.i18n.getMessage( 'estimationShort' ) + ' ' + displayCurrencyAmount( options.currency, amount * proportion, 2 ) + '</span>';
								}
								else if ( options.mode === 'month' )
								{
									proportion = ( daysInMonth( now ) * 86400000 ) / Math.max( 1, now.getTime() - getFirstDayOfMonth( now ).getTime() );
									estimation = '<br><span>' + chrome.i18n.getMessage( 'estimationShort' ) + ' ' + displayCurrencyAmount( options.currency, amount * proportion, 2 ) + '</span>';
								}

								// Create
								this.content.append( '<h5>' + chrome.i18n.getMessage( ( row.total > 1 ) ? 'numberReferralCutsPlural' : 'numberReferralCutsSingular', [ row.total ] ) + '</h5>' +
													 '<p><strong>' + displayCurrencyAmount( options.currency, amount, 2 ) + '</strong>' + estimation + '</p>' );
							}
		} ),

		progressLevel: new WidgetController( {
			'options':		[],
			'ressources':	[],
			'requests':		[ library.requests.globalStats ],
			'init':			function( options )
							{
								// Radial progress class
								this.div.addClass( 'envastats-progress-radial-widget' );

								// Chart div
								this.vars.chart = $( '<div class="envastats-progress-radial"></div>' ).appendTo( this.content );

								// Text div
								this.vars.desc = $( '<div class="envastats-progress-desc"></div>' ).appendTo( this.content );
							},
			'build':		function ( ressources, requests, options )
							{
								var amount = requests.globalStats.rows.item( 0 ).totalPrice,
									levels = ( typeof options.levels === 'string' ) ? envato.badges[ options.levels ] : options.levels,
									level = false, toNext, previous = levels[ 0 ],
									percentage = 100,
									i, max = levels.length;

								// Paw name
								for ( i = 0; i < max; ++i )
								{
									// If level not reached yet
									if ( amount < levels[ i ].start )
									{
										// Process
										percentage = ( ( amount - previous.start ) / ( levels[ i ].start - previous.start ) ) * 100;
										level = previous.name;
										toNext = chrome.i18n.getMessage( 'amountToNext', [ displayCurrencyAmount( envato.currency, levels[ i ].start - amount ) ] );
										break;
									}

									// Store for next level
									previous = levels[ i ];
								}

								// If over the max level
								if ( !level )
								{
									level = previous.name;
									toNext = chrome.i18n.getMessage( 'maxReached' );
								}

								// Build chart
								this.vars.chart.chart( {
									template: 'envastats_radialProgress',
									values: {
										serie1: [ percentage, 100 - percentage ]
									}
								} );

								// Text
								this.vars.desc.html( '<strong>' + level + '</strong><br>' + toNext );
							}
		} )

	} );



	/*************************************************************************/
	/*                           Currency functions                          */
	/*************************************************************************/

	/**
	 * Check if the active currency is USD
	 * @return boolean true if USD? else false
	 */
	function isCurrencyUSD()
	{
		return ( library.options.currency.get() === envato.currency );
	}

	/**
	 * Check if currency conversion is available
	 * @return boolean
	 */
	function isCurrencyRateAvailable()
	{
		return ( isCurrencyUSD() || library.options.oerKey.get() !== false );
	}

	/**
	 * Force refresh of current exchange rate
	 * @param function callback any function to be called when the rate is ready: function( rate ). Rate may be 'false' if not available/valid
	 * @return void
	 */
	function updateCurrentCurrencyRate( callback )
	{
		// Skip if not available
		if ( library.options.oerKey.get() === false )
		{
			return;
		}

		// If already loading
		if ( rates.callbacks.current )
		{
			// Add and wait
			rates.callbacks.current.add( callback );
			return;
		}

		// Create callback list
		rates.callbacks.current = new CallbackList();
		if ( callback )
		{
			rates.callbacks.current.add( callback );
		}

		// Log
		console.log( '~ Updating current conversion rates' );

		// Load
		$.ajax( {
			url:		rates.api.latest + '?app_id=' + library.options.oerKey.get(),
			dataType:	'json',
			success:	function( data )
			{
					// Actual currency
				var currency = library.options.currency.get(),
					cache, value;

				// If not valid
				if ( typeof data !== 'object' || !data.rates )
				{
					// Log
					console.log( '~ Invalid current conversion rates data' );

					// Set option
					library.options.currencyCurrentRate.set( false );

					// Callback
					if ( rates.callbacks.current )
					{
						rates.callbacks.current.call( false );
						delete rates.callbacks.current;
					}

					return;
				}

				// Log
				console.log( '~ Current conversion rates loaded' );

				// Store for further calls
				cache = getStoredObject( 'rates', {} );
				cache.current = {
					date: now.getTime(),
					rates: data.rates
				};
				setStoredObject( 'rates', cache );

				// Set option
				value = cache.current.rates[ currency ] ? cache.current.rates[ currency ] : false;
				library.options.currencyCurrentRate.set( value );

				// Callback
				if ( rates.callbacks.current )
				{
					rates.callbacks.current.call( value );
					delete rates.callbacks.current;
				}
			},
			error:		function()
			{
				// Log
				console.log( '~ Unable to load current conversion rates' );

				// Set option
				library.options.currencyCurrentRate.set( false );

				// Callback
				if ( rates.callbacks.current )
				{
					rates.callbacks.current.call( false );
					delete rates.callbacks.current;
				}
			}
		} );
	}

	/**
	 * Get current exchange rate. Follow code must be in the callback, because the function is asyncronous
	 * @param string currency the currency
	 * @param function callback any function to be called when the rate is ready: function( rate ). Rate may be 'false' if not available/valid
	 * @return void
	 */
	function getCurrentCurrencyRate( currency, callback )
	{
			// Stored rates
		var cache;

		// If using USD, no conversion needed
		if ( currency === envato.currency )
		{
			callback( 1 );
			return;
		}

		// If oer not available, fail
		if ( library.options.oerKey.get() === false )
		{
			callback( false );
			return;
		}

		// Check cache
		cache = getStoredObject( 'rates', {} );
		if ( cache.current )
		{
			// Check cache expiration
			if ( cache.current.date + rates.latestExpiration > now.getTime() )
			{
				// Direct call
				callback( cache.current.rates[ currency ] ? cache.current.rates[ currency ] : false );
				return;
			}
			else
			{
				// Clear cache
				delete cache.current;
				setStoredObject( 'rates', cache );
			}
		}

		// Force update
		updateCurrentCurrencyRate( callback );
	}

	/**
	 * Get the exchange rate at a given date. Follow code must be in the callback, because the function is asyncronous
	 * @param string currency the currency
	 * @param int year the year
	 * @param int month the month (0 - 11)
	 * @param int day the day of the month (0 - 31)
	 * @param function callback any function to be called when the rate is ready: function( rate ). Rate may be 'false' if not available/valid
	 * @return void
	 */
	function getCurrencyRateOn( currency, year, month, day, callback )
	{
			// Stored rates
		var cache,

			// Date key
			dateKey;

		// If using USD, no conversion needed
		if ( currency === envato.currency )
		{
			callback( 1 );
			return;
		}

		// If oer not available, fail
		if ( library.options.oerKey.get() === false )
		{
			callback( false );
			return;
		}

		// Check cache
		cache = getStoredObject( 'rates', {} );
		dateKey = year + '-' + padDateValue( month ) + '-' + padDateValue( day );
		if ( cache[ dateKey ] )
		{
			// Direct call
			callback( cache[ dateKey ][ currency ] ? cache[ dateKey ][ currency ] : false );
			return;
		}

		// If already loading
		if ( rates.callbacks[ dateKey ] )
		{
			// Add and wait
			rates.callbacks[ dateKey ].add( callback );
			return;
		}

		// Create callback list
		rates.callbacks[ dateKey ] = new CallbackList();
		rates.callbacks[ dateKey ].add( callback );

		// Log
		console.log( '~ Loading conversion rates for ' + dateKey );

		// Load
		$.ajax( {
			url:		rates.api.historical.replace( '{{date}}', dateKey ) + '?app_id=' + library.options.oerKey.get(),
			dataType:	'json',
			success:	function( data )
			{
				var cache;

				// If not valid
				if ( typeof data !== 'object' || !data.rates )
				{
					// Log
					console.log( '~ Invalid conversion rates data for ' + dateKey );

					// Callback
					if ( rates.callbacks[ dateKey ] )
					{
						rates.callbacks[ dateKey ].call( false );
						delete rates.callbacks[ dateKey ];
					}

					return;
				}

				// Log
				console.log( '~ Conversion rates for ' + dateKey + ' loaded' );

				// Store for further calls
				cache = getStoredObject( 'rates', {} );
				cache[ dateKey ] = data.rates;
				setStoredObject( 'rates', cache );

				// Callback
				if ( rates.callbacks[ dateKey ] )
				{
					rates.callbacks[ dateKey ].call( cache[ dateKey ][ currency ] ? cache[ dateKey ][ currency ] : false );
					delete rates.callbacks[ dateKey ];
				}
			},
			error:		function()
			{
				// Log
				console.log( '~ Unable to load conversion rates for ' + dateKey );

				// Callback
				if ( rates.callbacks[ dateKey ] )
				{
					rates.callbacks[ dateKey ].call( false );
					delete rates.callbacks[ dateKey ];
				}
			}
		} );
	}

	/**
	 * Get the conversion rate at which a month sales are converted when the author get its withdrawal: either the rate at convertDay on month +1, or the current rate
	 * @param string currency the currency
	 * @param int year the year
	 * @param int month the month (0 - 11)
	 * @param function callback any function to be called when the rate is ready: function( rate ). Rate may be 'false' if not available/valid
	 * @return boolean false if using current rates, true if using final month rate
	 */
	function getFinalMonthRate( currency, year, month, callback )
	{
			// Day of conversion
		var convertDay = library.options.currencyConvertDay.get(),

			// Current date
			currentMonth = now.getMonth() + 1,
			currentYear = now.getFullYear(),

			// Use current rate
			useCurrent;

		// Format
		month = parseInt( month, 10 );
		year = parseInt( year, 10 );

		/*
		 * Get currency rate day:
		 * - if day < convertDay, current and previous month use the current rate, others use rate at convertDay on month+1
		 * - if day >= convertDay, current month only use the current rate, others use rate at convertDay on month+1
		 */

		// Current month
		if ( month === currentMonth && year === currentYear )
		{
			useCurrent = true;
		}
		// Previous month if day < convertDay
		else if ( now.getDate() < convertDay &&
			 ( ( month < 12 && month === currentMonth - 1 && currentYear === year ) || ( month === 12 && currentMonth === 1 && currentYear === year + 1 ) ) )
		{
			useCurrent = true;
		}
		// Older months
		else
		{
			useCurrent = false;
		}

		// Get convert rate
		if ( useCurrent )
		{
			getCurrentCurrencyRate( currency, callback );
			return false;
		}
		else
		{
			// Rate date
			++month;
			if ( month > 12 )
			{
				month = 1;
				++year;
			}

			// Load
			getCurrencyRateOn( currency, year, month, convertDay, callback );
			return true;
		}
	}

	/*
	 * Set the new alternative currency
	 * @param string currency the new currency
	 * @param function callback any function to call when the process is done
	 * @return void
	 */
	function setNewAltCurrency( currency, callback )
	{
		currency = currency.toUpperCase();

		// Check if valid
		if ( !rates.currencies[ currency ] || currency === envato.currency || currency === library.options.currencyAlt.get() )
		{
			if ( callback )
			{
				callback( library.options.currencyAlt.get() );
			}
			return;
		}

		// If already updating, put on wait
		if ( rates.updating )
		{
			rates.waiting = {
				currency: currency,
				callback: callback
			};
			return;
		}

		// Set as alternative currency
		library.options.currencyAlt.set( currency );
		console.log( 'New alternative currency: ' + currency );

		// Mark as updating
		rates.updating = true;

		// Get oldest month in database
		db.transaction( function ( tx )
		{
			tx.executeSql( 'SELECT strftime(\'%m\', `date`) AS `month`, strftime(\'%Y\', `date`) AS `year` ' +
							'FROM `statements` ORDER BY `date` ASC LIMIT 1', [],
			function ( tx, result )
			{
				var month = parseInt( result.rows.item( 0 ).month, 10 ),
					year = parseInt( result.rows.item( 0 ).year, 10 );

				// Log
				console.log( 'Updating database statements currency' );

				// Start
				updateDatabaseConvertedAmounts( currency, year, month, callback );

			}, function ( tx, e )
			{
				console.log( 'Error while updating database statements currency: ' + e.message );
			} );

		} );
	}

	/**
	 * Update database to apply the newest rates conversion
	 * @param string currency the new currency
	 * @param int month the month to start with ( from 1 to 12 )
	 * @param int year the year to start with
	 * @param function callback an function to call when everything has been updated
	 * @return void
	 */
	function updateDatabaseConvertedAmounts( currency, year, month, callback )
	{
			// Iterative function to process months
		var processMonth = function()
			{
				var currentMonth = now.getMonth() + 1,
					currentYear = now.getFullYear(),
					waiting, useFinal;

				// If a new update process is waiting, abort
				if ( rates.waiting )
				{
					// Stop updating
					rates.updating = false;
					console.log( 'Aborting previous alternative currency update process' );

					// Start new process
					waiting = rates.waiting;
					rates.waiting = false;
					setNewAltCurrency( waiting.currency, waiting.callback );
					return;
				}

				// Next month
				++month;
				if ( month > 12 )
				{
					month = 1;
					++year;
				}

				// If we went past current month
				if ( ( month > currentMonth && year === currentYear ) || year > currentYear )
				{
					// Done updating
					rates.updating = false;
					console.log( 'Done updating database statements alternative currency' );

					// Callback
					if ( callback )
					{
						callback( currency );
					}

					return;
				}

				// Call
				useFinal = getFinalMonthRate( currency, year, month, function( value )
				{
					// Log
					console.log( 'Currency rate for ' + padDateValue( month ) + '/' + year + ': ' + value );

					value = value || 1;

					// Update database
					db.transaction(function (tx)
					{
						tx.executeSql( 'UPDATE `statements` SET `amount_converted`=`amount`*? WHERE strftime(\'%m-%Y\', `date`)=?',
						[ value, padDateValue( month ) + '-' + year ],
						function ( tx, result )
						{
							// Log
							console.log( 'Updated ' + result.rowsAffected + ' statements alternative currency for ' + padDateValue( month ) + '/' + year );

							// Set option
							if ( useFinal )
							{
								library.options.lastFinalizedMonth.set( { month: month, year: year } );
							}

							// Next month
							processMonth();

						}, function ( tx, e )
						{
							// Log
							console.log( 'Error while updating database statements alternative currency for ' + padDateValue( month ) + '/' + padDateValue( year ) + ': ' + e.message );

							// Next month
							processMonth();
						} );
					} );
				} );
			};

		// Format
		currency = currency.toUpperCase();

		// Offset back the month because processMonth() will increment the date
		--month;

		// First call
		processMonth();
	}



	/*************************************************************************/
	/*                           Utility functions                           */
	/*************************************************************************/

	/**
	 * Pad a date value to X chars with '0'
	 * @var int value the date value
	 * @param int length number of characters of the final string (optional, default: 2)
	 * @return int|string the value on 2 chars
	 */
	function padDateValue( value, length )
	{
		return str_pad( value, length || 2, '0', 'STR_PAD_LEFT' );
	}

	/**
	 * Index a result set by the given field
	 * @param SQLResultSet results the SQL result set
	 * @param string index name of the index field
	 * @param string prefix a prefix to add to the index (for instance, if numeric)
	 * @return object the indexed results
	 */
	function indexResultSet( results, index, prefix )
	{
		var data = {},
			row;

		// Prepare
		prefix = prefix || '';

		// Convert
		for ( i = 0; i < results.rows.length; ++i )
		{
			row = results.rows.item( i );
			data[ prefix + row[ index ] ] = row;
		}

		return data;
	}

	/**
	 * Get a date offset by the given number of days
	 * @param Date date the original date
	 * @param int offset the number of days to offset the date
	 * @param boolean preserveTime use true to keep the time part of the date, or false to get a date at 00:00:00
	 * @return Date the new date object
	 */
	function offsetDate( date, offset, preserveTime )
	{
			// Same date, at midnight
		var dateMidnight = new Date( date.getFullYear(),
									 date.getMonth(),
									 date.getDate(),
									 preserveTime ? date.getHours() : 0,
									 preserveTime ? date.getMinutes() : 0,
									 preserveTime ? date.getSeconds() : 0,
									 preserveTime ? date.getMilliseconds() : 0 );

		// New date
		return new Date( dateMidnight.getTime() + ( offset * 86400000 ) );
	}

	/**
	 * Get the date object of the first day of the week (monday)
	 * @param Date date the original date
	 * @return Date the new Date object
	 */
	function getFirstDayOfWeek( date )
	{
		var day = date.getDay(),
			offset = day ? day - 1 : 6;

		return new Date( date.getFullYear(), date.getMonth(), date.getDate() - offset );
	}

	/**
	 * Get the date object of the first day of the month
	 * @param Date date the original date
	 * @return Date the new Date object
	 */
	function getFirstDayOfMonth( date )
	{
		return new Date( date.getFullYear(), date.getMonth(), 1 );
	}

	/**
	 * Get the day of year from a date
	 * @param Date date the date object
	 * @return int the number of the day
	 */
	function getDayOfYear( date )
	{
		var year = new Date( date.getFullYear(), 0, 1 );
		return Math.floor( ( date.getTime() - year.getTime() ) / 86400000 ) + 1;
	}

	/**
	 * Get the week of year from a date
	 * @param Date date the date object
	 * @return int the number of the week
	 * @url http://stackoverflow.com/questions/6117814/get-week-of-year-in-javascript-like-in-php
	 */
	function getWeekNumber( date )
	{
			// First day of year
		var yearStart = new Date( date.getFullYear(), 0, 1 ),

			// Copy date so we don't modify original
			weekStart = new Date( date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0 ),

			// Week number
			weekNo;

		// Set to nearest Thursday: current date + 4 - current day number
		// Make Sunday's day number 7
		weekStart.setDate( weekStart.getDate() + 4 - ( weekStart.getDay() || 7 ) );

		// Calculate full weeks to nearest Thursday
		weekNo = Math.ceil( ( ( ( weekStart.getTime() - yearStart.getTime() ) / 86400000) + 1 ) / 7 );

		return weekNo;
	}

	/**
	 * Get the number of days in the month of the given date
	 * @param Date date the date object
	 * @return int the number of days
	 */
	function daysInMonth( date )
	{
		var year = date.getFullYear(),
			month = date.getMonth() + 1;

		if ( month > 11 )
		{
			month = 0;
			++year;
		}

		return new Date( year, month, 0 ).getDate();
	}

	/**
	 * Remove an element with fading then folding effect
	 *
	 * @param string|int duration a string (fast, normal or slow) or a number of millisecond. Default: 'normal'. - optional
	 * @param function callback any function to call at the end of the effect. Default: none. - optional
	 */
	$.fn.fadeAndRemove = function(duration, callback)
	{
		this.animate( { 'opacity': 0 }, {
			'duration': duration,
			'complete': function()
			{
				var element = $(this).trigger( 'endfade' );

				// No folding required if the element has position: absolute (not in the elements flow)
				if ( element.css( 'position' ) == 'absolute' )
				{
					// Callback function
					if ( callback )
					{
						callback.apply( this );
					}

					element.remove();
				}
				else
				{
					element.slideUp( duration, function()
					{
						// Callback function
						if ( callback )
						{
							callback.apply( this );
						}

						element.remove();
					});
				}
			}
		});

		return this;
	};

	/**
	 * Format a number (from phpjs.org)
	 * @param float number
	 * @param int decimals
	 * @param string dec_point
	 * @param string thousands_sep
	 * @return string
	 */
	function number_format ( number, decimals, dec_point, thousands_sep )
	{
		number = (number + '').replace(/[^0-9+\-Ee.]/g, '');
		var n = !isFinite(+number) ? 0 : +number,
			prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
			sep = (typeof thousands_sep === 'undefined') ? __l10n( 'thousands_sep' ) : thousands_sep,
			dec = (typeof dec_point === 'undefined') ? __l10n( 'dec_point' ) : dec_point,
			s = '',
			toFixedFix = function (n, prec) {
				var k = Math.pow(10, prec);
				return '' + Math.round(n * k) / k;
			};
		// Fix for IE parseFloat(0.55).toFixed(0) = 0;
		s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.');
		if (s[0].length > 3) {
			s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
		}
		if ((s[1] || '').length < prec) {
			s[1] = s[1] || '';
			s[1] += new Array(prec - s[1].length + 1).join('0');
		}
		return s.join(dec);
	}

	/**
	 * Returns input string padded on the left or right to specified length with pad_string (from phpjs.org)
	 * @param mixed input
	 * @param intpad_length
	 * @param string pad_string
	 * @param string pad_type
	 * @return string
	 */
	function str_pad ( input, pad_length, pad_string, pad_type )
	{
		var half = '',
			pad_to_go;

		var str_pad_repeater = function (s, len) {
			var collect = '',
				i;

			while (collect.length < len) {
				collect += s;
			}
			collect = collect.substr(0, len);

			return collect;
		};

		input += '';
		pad_string = pad_string !== undefined ? pad_string : ' ';

		if (pad_type != 'STR_PAD_LEFT' && pad_type != 'STR_PAD_RIGHT' && pad_type != 'STR_PAD_BOTH') {
			pad_type = 'STR_PAD_RIGHT';
		}
		if ((pad_to_go = pad_length - input.length) > 0) {
			if (pad_type == 'STR_PAD_LEFT') {
				input = str_pad_repeater(pad_string, pad_to_go) + input;
			} else if (pad_type == 'STR_PAD_RIGHT') {
				input = input + str_pad_repeater(pad_string, pad_to_go);
			} else if (pad_type == 'STR_PAD_BOTH') {
				half = str_pad_repeater(pad_string, Math.ceil(pad_to_go / 2));
				input = half + input + half;
				input = input.substr(0, pad_length);
			}
		}

		return input;
	}



	/*************************************************************************/
	/*                          Elychart templates                           */
	/*************************************************************************/

	$.extend( $.elycharts.templates, {

		// Lines generic config
		envastats_generic: {

			// Data series defaults
			defaultSeries: {
				tooltip: {
					height: 24,
					width: 120,
					padding: [5, 7],
					roundedCorners: 2,
					frameProps: {
						stroke: '#ccc',
						'stroke-width': 1,
						fill: 'white'
					},
					contentStyle: {
						'text-shadow': '0 1px 0 white'
					}
				},

				// Initial setup animation
				startAnimation : {
					active : true,
					type : 'grow'
				}
			}
		},

		envastats_sales: {

			// Main configuration
			type: 'line',
			margins: [ 4, 45, 20, 30 ],
			template: 'envastats_generic',

			defaultSeries: {
				tooltip: {
					height: 39,
					width: 150
				}
			},

			// Series-specific config
			series: {

				serie1: {
					type: 'bar',
					color: '#f36',
					barWidthPerc: 40,
					plotProps: {
						'stroke-width': 0
					}
				},

				serie2: {
					axis: 'r',
					color: '#39F',

					plotProps: {
						'stroke-width': 5
					},

					dot: true,

					dotProps: {
						fill: '#7ebfff',
						stroke: '#444',
						size: 1,
						'stroke-width': 2
					},

					highlight: {
						scaleSpeed: 200,
						scaleEasing: '>',
						scale: 7 // enlarge the dot on hover
					}
				}

			},

			// Default values for axis
			defaultAxis: {
				labels: true,
				labelsSkip: 1,
				labelsMargin: 0,
				labelsDistance: 10,
				labelsHideCovered: false,
				labelsProps: {
					fill: '#AAA',
					'font-size': '11px',
					'font-weight': 'bold'
				}
			},

			// Axis labels
			axis: {

				// Left axis
				l: {
					labelsAnchor: 'end'
				},

				// Right axis
				r: {
					labelsAnchor: 'start'
				}
			},

			// Behavior
			features: {

				mousearea: {
					type: 'index'
				},

				/*tooltip: {
					positionHandler: function( env, tooltipConf, mouseAreaData, suggestedX, suggestedY )
					{
						return [ mouseAreaData.event.pageX, mouseAreaData.event.pageY, true ]
					}
				},*/

				grid: {

					// Draw no grid
					draw: false,

					// Divisions for Y grid
					ny: 7,

					// Draw rectangular zones
					oddHProps: {
						fill: '#CCC',
						opacity: .1,
						'stroke-width': 0
					},

					ticks: {
						active: [false, false, false]
					}
				}
			}
		},

		envastats_salesWeek: {

			// Main configuration
			type: 'line',
			margins: [ 10, 10, 20, 30 ],
			template: 'envastats_generic',

			// Series-specific config
			series: {

				serie1: {
					type: 'line',
					color: '#39F',
					fill: true,

					plotProps: {
						'stroke-width': 5
					},

					dot: true,

					dotProps: {
						fill: '#7ebfff',
						stroke: '#444',
						size: 1,
						'stroke-width': 2
					},

					highlight: {
						scaleSpeed: 200,
						scaleEasing: '>',
						scale: 7 // enlarge the dot on hover
					}
				}
			},

			// Default values for axis
			defaultAxis: {
				labels: true,
				labelsSkip: 1,
				labelsMargin: 0,
				labelsDistance: 10,
				labelsProps: {
					fill: '#AAA',
					'font-size': '11px',
					'font-weight': 'bold'
				}
			},

			// Axis labels
			axis: {

				// Left axis
				l: {
					labelsAnchor: 'end'
				}
			},

			// Behavior
			features: {

				mousearea: {
					type: 'index'
				},

				/*tooltip: {
					positionHandler: function( env, tooltipConf, mouseAreaData, suggestedX, suggestedY )
					{
						return [ mouseAreaData.event.pageX, mouseAreaData.event.pageY, true ]
					}
				},*/

				grid: {

					// Draw no grids
					draw: false,

					// Divisions for Y grid
					ny: 4,

					// Draw rectangular zones
					oddHProps: {
						fill: '#CCC',
						opacity: .1,
						'stroke-width': 0
					},

					ticks: {
						active: [false, false, false]
					}
				}
			}
		},

		envastats_salesHour: {

			// Main configuration
			type: 'line',
			margins: [ 10, 45, 20, 10 ],
			template: 'envastats_generic',

			// Series-specific config
			series: {

				serie1: {
					axis: 'r',
					type: 'line',
					color: '#39F',
					fill: true,

					plotProps: {
						'stroke-width': 5
					},

					dot: true,

					dotProps: {
						fill: '#7ebfff',
						stroke: '#444',
						size: 1,
						'stroke-width': 2
					},

					highlight: {
						scaleSpeed: 200,
						scaleEasing: '>',
						scale: 7 // enlarge the dot on hover
					}
				}
			},

			// Default values for axis
			defaultAxis: {
				labels: true,
				labelsSkip: 1,
				labelsMargin: 0,
				labelsDistance: 10,
				labelsProps: {
					fill: '#AAA',
					'font-size': '11px',
					'font-weight': 'bold'
				}
			},

			// Axis labels
			axis: {

				// Left axis
				r: {
					labelsAnchor: 'start'
				}
			},

			// Behavior
			features: {

				mousearea: {
					type: 'index'
				},

				/*tooltip: {
					positionHandler: function( env, tooltipConf, mouseAreaData, suggestedX, suggestedY )
					{
						return [ mouseAreaData.event.pageX, mouseAreaData.event.pageY, true ]
					}
				},*/

				grid: {

					// Draw no grids
					draw: false,

					// Divisions for Y grid
					ny: 4,

					// Draw rectangular zones
					oddHProps: {
						fill: '#CCC',
						opacity: .1,
						'stroke-width': 0
					},

					ticks: {
						active: [false, false, false]
					}
				}
			}
		},

		envastats_radialProgress: {

			type : 'pie',

			defaultSeries : {
				r : -0.65,
				values : [{
					plotProps : {
						fill: '#39F'
					}
				}, {
					plotProps : {
						fill: '#39F',
						opacity: 0.3
					}
				}],
				plotProps : {
					stroke : false
				},
				startAnimation : {
					active : true,
					type : 'avg'
				}
			}

		},

		envastats_radialDispatch: {

			template: 'envastats_generic',
			type : 'pie',

			defaultSeries : {
				r : -0.6,
				tooltip: {
					height: 39,
					width: 200
				},
				plotProps : {
					stroke : false
				},
				label : {
					active : false
				},
				highlight : {
					newProps : {
						opacity : 0.8
					}
				},
				startAnimation : {
					active : true,
					type : 'avg'
				}
			}
		}

	} );

})(jQuery, window, document);