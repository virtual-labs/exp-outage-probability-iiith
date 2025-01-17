function openPart(evt, name){
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(name).style.display = "block";
    evt.currentTarget.className += " active";
}

function startup() {
    document.getElementById("default").click();
}

window.onload = startup;


function erf(x) {
  
    var a1 = 0.254829592;
    var a2 = -0.284496736;
    var a3 = 1.421413741;
    var a4 = -1.453152027;
    var a5 = 1.061405429;
    var p = 0.3275911;

    // Save the sign of x
    var sign = (x >= 0) ? 1 : -1;
    x = Math.abs(x);

    // Approximation of the error function
    var t = 1.0 / (1.0 + p * x);
    var y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
}

function Q_function(x){
    return 0.5 * (1 - erf(x / Math.sqrt(2)));
}

function getOutput1() {
    const Pt = parseFloat(document.getElementById("Pt").value);
    const P_min = parseFloat(document.getElementById("P_min").value);
    const d = parseFloat(document.getElementById("d").value);
    const freq = parseFloat(document.getElementById("fc").value);
    const fc = freq * 1000000;

    // Speed of light in m/s
    const c = 3e8;

    // Wavelength
    const lambda = c / fc;

    // Calculate received power in dB
    let P_out_helper = 10 * Math.log10(Pt) + 20 * Math.log10(lambda / (4 * Math.PI * d));

    // Calculate P_out
    let P_out = Q_function((P_min - P_out_helper) / 1);

    // Calculate coverage
    let coverage = 1 - P_out;

    // Display the results
    document.getElementById("observations").innerHTML = `
    <p><strong>P_out:</strong> ${P_out.toFixed(6)}</p>
    <p><strong>Coverage:</strong> ${coverage.toFixed(6)}</p>
   `;
}


function getOutput2() {

    const Pt = parseFloat(document.getElementById("Pt2").value);
    const P_min = parseFloat(document.getElementById("P_min2").value);
      const freq = parseFloat(document.getElementById("fc2").value);
    const fc=freq*1000000;
    let lamda=3e8/fc;
    const distances = [];
    const outage= [];
    for (let d =0; d <=10; d+=1) {
        let P_out_helper;
        distances.push(d.toFixed(1));
        P_out_helper=(10*Math.log10(Pt)+20*Math.log10(lamda/(4*Math.PI*d)));
        let P_out=1-Q_function((P_min-P_out_helper),0,1);
        outage.push(P_out.toFixed(2));
    }
    document.getElementById("observations2").innerHTML=`
        <canvas id="outage_chart"></canvas>
    `;
    const canvas = document.getElementById('outage_chart');
    canvas.width = 2000;  // Set the desired width
    canvas.height= 5500;  
    const ctx = canvas.getContext('2d');  // Get the 2D context

    new Chart(ctx, {

        type: 'scatter',
    
        data: {
    
            labels: distances,
    
            datasets: [{
    
                label: 'P_out',
    
                data: outage,
    
                backgroundColor:'yellow',
    
                borderColor: 'green',
    
                fill: false,
    
            }]
    
        },
    
        options: {
    
            scales: {
    
                x: {
    
                    title: {
    
                        display: true,
                        text: 'Distance (m)'
                    }
    
                },
    
                y: {
    
                    title: {
    
                        display: true,
    
                        text: 'outage'
    
                    },
                    ticks: {

                        beginAtZero: true,
    
                        min: 0,
    
                        max: 1,
    
                        stepSize: 0.1
    
                    }
    
                }
    
            }
    
        }
    
    });
}


