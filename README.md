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
    <script src="https://cdn.jsdelivr.net/combine/npm/chart.js@2.9.3,npm/jquery@3.5.1,npm/sasjs@2.12.4"></script> 
    <script>
    function initSasJs() {
      // instantiate sasjs with options such as backend app location
      sasJs = new SASjs.default({appLoc: "/Public/app/readme",serverType:"SAS9"});
      // login (it's also possible to set an autologin when making requests)
      sasJs.logIn(document.querySelector("#username").value
        ,document.querySelector("#password").value
      ).then((response) => {
        if (response.isLoggedIn === true) {
          $('.login').hide()
          $('#getdata').show()
        }
      })
    }
    function getData(){
      // make a request to a SAS service, sending data if needed
      sasJs.request("/common/getdata", {fromjs: [{ type: "Sports" }] })
    }
    </script>
  </head>
  <body>
    <h1>Demo Seed App for <span class="code">SASjs</span></h1>
    <div class="login" id="login-form">
      <input type="text" id="username" placeholder="Enter username" />
      <input type="password" id="password" placeholder="Enter password" />
    </div>
    <button id="login" onclick="initSasJs()" class="login">Log in</button>
    <button id="getdata" onclick="getData()" style="display:none">Get Data</button>
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