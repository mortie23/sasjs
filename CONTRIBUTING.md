# Contributing

Contributions to SASjs are very welcome!  When making a PR, test cases should be included.  To help in unit testing, be sure to run the following when making changes:

```
# the following creates a tarball in the build folder of SASjs
npm run-script package:lib

# now go to your app and run:
npm install ../sasjs/build/<tarball filename>
```

Tests are run using cypress.  Before running tests, you need to define the following backend services:

# SAS 9
```

filename mc url "https://raw.githubusercontent.com/macropeople/macrocore/master/mc_all.sas?_=1";
%inc mc;
filename ft15f001 temp;
parmcards4;
%webout(OPEN)
%macro x();
%do i=1 %to &_webin_file_count; %webout(OBJ,&&_webin_name&i) %end;
%mend; %x()
%webout(CLOSE)
;;;;
%mm_createwebservice(path=/Public/app/common,name=sendObj,code=ft15f001,replace=YES)
parmcards4;
%webout(OPEN)
%macro x();
%do i=1 %to &_webin_file_count; %webout(ARR,&&_webin_name&i) %end;
%mend; %x()
%webout(CLOSE)
;;;;
%mm_createwebservice(path=/Public/app/common,name=sendArr,code=ft15f001,replace=YES)

```

# Viya
```
%* Step 1 - load macros and obtain refresh token (must be ADMIN);
filename mc url "https://raw.githubusercontent.com/macropeople/macrocore/master/mc_all.sas";
%inc mc;
%let client=new%sysfunc(ranuni(0),hex16.);
%let secret=MySecret;
%mv_getapptoken(client_id=&client,client_secret=&secret)

%* Step 2 - navigate to the url in the log and paste the access code below;
%mv_getrefreshtoken(client_id=&client,client_secret=&secret,code=wKDZYTEPK6)
%mv_getaccesstoken(client_id=&client,client_secret=&secret)

%* parmcards lets us write to a text file from open code ;
filename ft15f001 temp;
parmcards4;
%webout(OPEN)
%global sasjs_tables;
%let sasjs_tables=&sasjs_tables;
%put &=sasjs_tables;
%let sasjs_tables=&sasjs_tables;
%macro x();
%global sasjs_tables;
%do i=1 %to %sysfunc(countw(&sasjs_tables));
  %let table=%scan(&sasjs_tables,&i);
  %webout(OBJ,&table)
%end;
%mend;
%x()
%webout(CLOSE)
;;;;
%mv_createwebservice(path=/Public/app/common,name=sendObj,code=ft15f001,replace=YES)
filename ft15f001 temp;
parmcards4;
%webout(OPEN)
%global sasjs_tables;
%let sasjs_tables=&sasjs_tables;
%put &=sasjs_tables;
%macro x();
%do i=1 %to %sysfunc(countw(&sasjs_tables));
  %let table=%scan(&sasjs_tables,&i);
  %webout(ARR,&table)
%end;
%mend;
%x()
%webout(CLOSE)
;;;;
%mv_createwebservice(path=/Public/app/common,name=sendArr,code=ft15f001,replace=YES)
```

The above services will return anything you send.  To run the tests simply launch `npm run cypress`.