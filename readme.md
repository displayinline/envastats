# Envastats

Envastats is a Chrome extension built to provide meaningful reports about sales on Envato's marketplaces. At first I wanted to display a simple chart of sales, but after way more time than planned, I ended up with a multiple features widgetized dashboard - I just don't know how to keep things simple...

Currently this extension is still in beta, so if you notice bug please report them using the bug tracking system.

## Main features:

- Display sales and earnings for the last 30 days, 6 months or for all time
- Display sales and earnings distributions by items (12 most populars), days of week and hours of the day
- Display counters for number of sales, amount sold, earnings and referral cuts, for three different time ranges: all time, current month and current week.
- Provides estimations for the end of the current week and month
- Display progress circles for paws, author's rate and elite levels (once maximum rate is reached)
- Provides intelligent currency conversion: each sale is converted at the rate of the day where the corresponding earnings are sent to the author (the 15th of the n+1 month).
- Actual rate is updated every 2 hours (requires a free Open Exchange Rate account app ID)
- Automatic refresh each 15 minutes, also provides a button for manual refresh
- Buttons to reset settings or database in case something's broken
- Based on local storage and IndexedDB
- Uses a widgets structure, a customization tool is planned (see below)
- l10n and i18n (english and french available, feel free to provide your own translation!)

## Planned features:

- Add daily and hourly average sales rate
- Add a desktop notification for each new sale and increment the counter in the main bar icon, with a button to reset counter
- Display items' distribution in the sales/earnings chart using stacked bars/lines
- Add PayPal/Payoneer fees processing for real income output
- Show a slider of the whole time range with two cursors to define start and end of displayed range
- Display progression in the week and month sales reports (against previous week/month), using green up arrow or red down arrow and the progression percentage
- Allow users to customize their dashboard (widgets, positions and sizes)
- Add a widgets API to allow adding extra widgets
- Color themes
- A full-screen mode to use this as a permanent dashboard

## Credits:

### Inspirational plugins

Many ideas are taken from the following plugins, credits to their authors!

- [Envato Currency Converter](http://extras.envato.com/browser-plugins/envato-currency-converter/)
- [Envato Sales Notification](http://extras.envato.com/browser-plugins/envato-sales-notification/)
- [EnvatoMator](http://extras.envato.com/browser-plugins/envatomator/)
- [Pixelentity Statement Booster](http://extras.envato.com/browser-plugins/envato-statement-booster/)
- [Statementer for Envato's marketplaces](http://extras.envato.com/browser-plugins/statementer-for-envatos-marketplaces/)

### External plugins:

- [jQuery](http://jquery.com/)
- [Elycharts](http://elycharts.com)
- [Raphaël](http://raphaeljs.com/)

##Licence

Licenced under the MIT License