
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async() => {

    let result = null;

    let contract = new Contract('localhost', () => {

        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error,result);
            display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error, value: result} ]);
        });

        DOM.elid('fund-airline').addEventListener('click', () => {
            // Write transaction
            contract.fund((error, result) => {
                if(error) console.log(error);
                if(result) console.log(result);
            });
        })

        DOM.elid('register-flight').addEventListener('click', () => {
            let flight = DOM.elid('flight-number-register-flight').value;
            let timestamp = DOM.elid('flight-timestamp-register-flight').value;
            // Write transaction
            contract.registerFlight(flight, timestamp, (error, result) => {
                if(error) console.log(error);
                if(result) console.log(result);
            });
        })

        DOM.elid('buy-flight-insurance').addEventListener('click', () => {
            let airline = DOM.elid('airine-address-buy-insurance').value;
            let flight = DOM.elid('flight-number-buy-insurance').value;
            let timestamp = DOM.elid('flight-timestamp-buy-insurance').value;
            // Write transaction
            contract.buyFlightInsurance(airline, flight, timestamp, (error, result) => {
                if(error) console.log(error);
                if(result) console.log(result);
            });
        })

        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let flight = DOM.elid('flight-number').value;
            let timestamp = DOM.elid('flight-timestamp').value;
            // Write transaction
            contract.fetchFlightStatus(flight, timestamp, (error, result) => {
                display('Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: error, value: result.flight + ' ' + result.timestamp} ]);
            });
        })
    
    });
    

})();


function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}







