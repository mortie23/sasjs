[![](https://data.jsdelivr.com/v1/package/npm/sasjs/badge)](https://www.jsdelivr.com/package/npm/sasjs)

# SASjs

SASjs is a open-source framework for building Web Apps on SAS® platforms. You can use as much or as little of it as you like. This repository contains the JS adapter, the part that handles the to/from SAS communication on the client side. There are 3 ways to install it:

1 - `npm install sasjs` - for use in a node project

2 - [Download](https://cdn.jsdelivr.net/npm/sasjs/index.js) and use a copy of the latest JS file

3 - Reference directly from the CDN - in which case click [here](https://www.jsdelivr.com/package/npm/sasjs?tab=collection) and select "SRI" to get the script tag with the integrity hash.

If you are short on time and just need to build an app quickly, then check out [this video](https://vimeo.com/393161794) and the [react-seed-app](https://github.com/macropeople/react-seed-app) which provides some boilerplate.

For more information on building web apps with SAS, check out [sasjs.io](https://sasjs.io)


## None of this makes sense.  How do I build an app with it?

Ok ok.  Deploy the following HTML:

```
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" http-equiv="X-UA-Compatible" content="IE=edge" />
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css" integrity="sha384-Vkoo8x4CGsO3+Hhxv8T/Q5PaXtkKtu6ug5TOeNV6gBiFeWPGFN9MuhOf23Q9Ifjh" crossorigin="anonymous">
    <script src="https://cdn.jsdelivr.net/combine/npm/chart.js@2.9.3,npm/jquery@3.5.1,npm/sasjs@2.12.4"></script> 
    <script>
      var sasJs = new SASjs.default({appLoc: "/Products/demo/readme",serverType:"SAS9", debug: "false"});
      function initSasJs() {
        $('#loading-spinner').show()
        // instantiate sasjs with options such as backend app location
        // login (it's also possible to set an autologin when making requests)
        sasJs.logIn($('#username')[0].value
          ,$('#password')[0].value
        ).then((response) => {
          if (response.isLoggedIn === true) {
            $('#loading-spinner').hide()
            $('.login').hide()
            $('#getdata').show()
            $('#cars').show()
          }
        })
      }

      function getData(){
        $('#loading-spinner').show()
        $('#myChart').remove();
        $('#chart-container').append('<canvas id="myChart" style="display: none;"></canvas>')
        // make a request to a SAS service, sending data if needed
        var type = $("#cars")[0].options[$("#cars")[0].selectedIndex].value;
        sasJs.request("/common/getdata", {fromjs: [{ type: type }] }).then((response) => {
          $('#myChart').show();
          var labels = []
          var data = []
          response.areas.map((d) => {
            labels.push(d.MAKE);
            data.push(d.AVPRICE);
          })
          $('#loading-spinner').hide()
          initGraph(labels, data, type);
        })
      }

      function initGraph(labels, data, type){
        var myCanvas = document.getElementById("myChart");
        var ctx = myCanvas.getContext("2d");
        var myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: "Average Invoice Price in USD for " + type + " Cars by Manufacturer",
                    data: data,
                    backgroundColor: "rgba(255,99,132,0.2)",
                    borderColor: "rgba(255,99,132,1)",
                    borderWidth: 1,
                    hoverBackgroundColor: "rgba(255,99,132,0.4)",
                    hoverBorderColor: "rgba(255,99,132,1)",
                }]
            },
            options: {
                maintainAspectRatio: false,
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero: true
                        }
                    }]
                }
            }
        });
      }
      
    </script>
  </head>
  <body>
    <div class="container-fluid" style="text-align: center; margin-top: 10px;">
      <div class="row">
          <div class="col-lg-5 col-md-7 col-sm-10 mx-auto mx-auto">
          <h1>Demo Seed App for <span class="code">SASjs</span></h1>
          <div class="login" id="login-form">
            <div class="form-group">
              <input class="form-control" type="text" id="username" placeholder="Enter username" />
            </div>
            <div class="form-group">
              <input class="form-control" type="password" id="password" placeholder="Enter password" />
            </div>
            <button id="login" onclick="initSasJs()" class="login btn btn-primary" style="margin-bottom: 5px;">Log In</button>
          </div>
          <select name="cars" id="cars" style="margin-bottom: 5px; display: none;" class="form-control">
            <option value="Hybrid">Hybrid</option>
            <option value="SUV">SUV</option>
            <option value="Sedan">Sedan</option>
            <option value="Sports">Sports</option>
            <option value="Truck">Truck</option>
            <option value="Wagon">Wagon</option>
          </select>
          <button id="getdata" onclick="getData()" style="margin-bottom: 5px; display: none;" class="btn btn-success">Get Data</button>
          <br><br>
          <div id="loading-spinner" class="spinner-border text-primary" role="status" style="display: none;">
            <span class="sr-only">Loading...</span>
          </div>
          <br>
        </div>
      </div>
    </div>
    <div id="chart-container" style="height: 65vh; width: 100%; position: relative; margin: auto;">
      <canvas id="myChart" style="display: none;"></canvas>
    </div>
  </body>
</head>
```

The backend part can be deployed as follows:

```
%let appLoc=/Public/app/readme;  /* Metadata or Viya Folder location as per SASjs config */
filename mc url "https://raw.githubusercontent.com/macropeople/macrocore/master/mc_all.sas";
%inc mc; /* compile macros */
filename ft15f001 temp;
parmcards4;
  %webout(FETCH) /* receive all data as SAS datasets */
  proc sql;
  create table areas as select make,mean(invoice) as avprice
    from sashelp.cars
    where type in (select type from work.fromjs)
    group by 1;
  %webout(OPEN)
  %webout(OBJ,areas)
  %webout(CLOSE)
;;;;
%mp_createwebservice(path=&appLoc/common,name=getdata)
```

You now have a simple web app with a backend service!

# More resources

Checkout this [link](https://sasjs.io/training/resources/) or contact the [author](https://www.linkedin.com/in/allanbowe/) directly.